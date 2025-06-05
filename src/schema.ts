import { Schema, type NodeSpec, type MarkSpec, MarkType, Node as ProseMirrorNode } from 'prosemirror-model'
import { Slice, Fragment } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import { undo, redo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { history } from 'prosemirror-history'

import { Plugin as PMPlugin, PluginKey, Selection } from 'prosemirror-state'

// Define custom annotation mark (MarkSpec)
const annotationMark: MarkSpec = {
  attrs: {
    meta: { default: null },
  },
  toDOM: (mark) => {
    return ['mark', { meta: mark.attrs.meta }, 0]
  },
  parseDOM: [
    {
      tag: 'mark[meta]',
      getAttrs: (dom) => {
        const meta = dom.getAttribute('meta')
        return { meta }
      },
    },
  ],
}

// Convert marks to plain objects
const marks: { [key: string]: MarkSpec } = {
  ...basicSchema.spec.marks,
  annotation: annotationMark,
}

const nodes: { [key: string]: NodeSpec } = {
  doc: { content: 'block+' },
  paragraph: {
    ...basicSchema.spec.nodes.get('paragraph'),
    marks: '_',
    content: 'inline*',
  },
  blockquote: {
    ...basicSchema.spec.nodes.get('blockquote'),
    marks: '_',
  },
  text: {
    ...basicSchema.spec.nodes.get('text'),
  },
  hard_break: {
    ...basicSchema.spec.nodes.get('hard_break'),
  },
}

// Create the schema
export const schema = new Schema({
  nodes,
  marks,
})

export const keyBoardPlugins = {
  undoRedoKeymap: keymap({
    'Mod-z': undo,
    'Mod-Shift-z': redo,
  }),
  historyPlugin: history(),
  backspaceKeymap: keymap({
    Backspace: (state, dispatch) => {
      const { $from } = state.selection
      const parent = $from.node($from.depth)

      if (parent.type.name === 'paragraph') {
        if (parent.content.size === 0) {
          if (dispatch) {
            const tr = state.tr.delete($from.before(), $from.after())
            dispatch(tr)
          }
          return true
        }

        if ($from.parentOffset === 0) {
          if (dispatch) {
            const prevPos = $from.before($from.depth)
            const tr = state.tr.delete(prevPos - 1, $from.pos)
            dispatch(tr)
          }
          return true
        }
      }

      return false
    },
  }),
}

export function createPreventLineBreakPlugin(onError: (msg: string) => void) {
  return [
    new PMPlugin({
      key: new PluginKey('preventLineBreakInAnnotations'),
      props: {
        handleTextInput(view, from, to, text) {
          const state = view.state
          const $from = state.doc.resolve(from)
          const insideAnnotation = $from.marks().some(mark => mark.type.name === 'annotation')

          if (insideAnnotation && text.includes('\n')) {
            onError('Annotations across line breaks are not allowed.')
            return true
          }
          return false
        },
        handleKeyDown(view, event) {
          const $from = view.state.selection.$from
          const insideAnnotation = $from.marks().some(mark => mark.type.name === 'annotation')

          if (event.key === 'Enter' && insideAnnotation) {
            onError('Annotations across line breaks are not allowed.')
            return true
          }
          return false
        },
      },
      appendTransaction: (transactions, oldState, newState) => {
        const tr = transactions.find((t) => t.docChanged)
        if (!tr) return null

        let filteredTr = newState.tr
        let modified = false

        newState.doc.descendants((node, pos) => {
          if (
            node.marks?.some((mark) => mark.type.name === 'annotation') &&
            node.type.name === 'hard_break'
          ) {
            filteredTr = filteredTr.delete(pos, pos + node.nodeSize)
            modified = true
          }
        })

        return modified ? filteredTr : null
      },
    }),

    keymap({
      Enter: (state, dispatch) => {
        const { $from } = state.selection
        const insideAnnotation = $from.marks().some(mark => mark.type.name === 'annotation')

        if (insideAnnotation) {
          onError('Annotations across line breaks are not allowed.')
          return true
        }

        const parent = $from.node($from.depth)
        if (parent.type.name === 'paragraph' || parent.isTextblock) {
          if (dispatch) {
            const atEnd = $from.parentOffset === $from.parent.content.size
            const tr = atEnd
              ? state.tr.insert($from.pos, state.schema.nodes.hard_break.create())
              : state.tr.replaceSelectionWith(state.schema.nodes.hard_break.create())
            dispatch(tr.scrollIntoView())
          }
          return true
        }

        return false
      },
    }),
  ]
}

export function createPasteNormalizerPlugin(schema: Schema, onError?: (msg: string) => void) {
  return new PMPlugin({
    key: new PluginKey('normalizePaste'),
    props: {
      handlePaste(view, event, slice) {
        const { state } = view;
        const { selection, doc } = state;
        const pos = selection.from;
        const $pos = doc.resolve(pos);
        const annotationMarkType = schema.marks.annotation;

        const insideAnnotation = $pos.marks().some(mark => mark.type === annotationMarkType);
        if (insideAnnotation) {
          if (onError) {
            onError("Pasting Text inside an annotation is not allowed. \n Enter it manually by keyboard.");
          }
          return true; 
        }

        const text = slice.content.textBetween(0, slice.content.size, '\n');
        const lines = text.split(/\r?\n/);

        const nodes: Array<ProseMirrorNode> = [];

        lines.forEach((line, index) => {
          if (line) {
            nodes.push(schema.text(line, []));
          }
          if (index < lines.length - 1) {
            nodes.push(schema.nodes.hard_break.create());
          }
        });

        const fragment = Fragment.fromArray(nodes);
        const newSlice = new Slice(fragment, 0, 0);
        const tr = state.tr.replaceSelection(newSlice).scrollIntoView();

        view.dispatch(tr);
        return true;
      },
    },
  });
}


export function createAnnotationClickEdgePlugin() {
  return new PMPlugin({
    key: new PluginKey('annotationClickEdge'),
    props: {
      handleClick(view, pos) {
        const { state, dispatch } = view
        const doc = state.doc
        const annotationMarkType = schema.marks.annotation
        const $pos = doc.resolve(pos)

        if (!$pos.marks().some(mark => mark.type === annotationMarkType)) {
          return false
        }

        if (!$pos.marks().some(mark => mark.type === annotationMarkType)) {
          const parent = $pos.parent;
          const offset = $pos.parentOffset;

          if (offset < parent.content.size) {
            const nextNode = parent.child(offset);
            if (nextNode.type.name === 'hard_break') {
              const tr = state.tr.insert(pos, schema.text(' '));
              dispatch(tr);
              return true;
            }
          }

          if (pos === 0) {
            const tr = state.tr.insert(0, schema.text(' '));
            dispatch(tr);
            return true;
          }

          if (pos === doc.content.size) {
            const tr = state.tr.insert(doc.content.size, schema.text(' '));
            dispatch(tr);
            return true;
          }
          return false;
        }

        const { start, end } = getMarkRange(doc, pos, annotationMarkType)

        const currentSelectionPos = state.selection.from

        if (pos === start) {
          if (pos !== currentSelectionPos) {
            const $newPos = doc.resolve(pos - 1 < 0 ? 0 : pos - 1)
            const tr = state.tr.setSelection(Selection.near($newPos))
            dispatch(tr)
            return true
          }
        }

        if (pos === end) {
          const $pos = doc.resolve(pos);
          const node = $pos.parent;
          const offset = $pos.parentOffset;
        
          const child = node.childAfter(offset);
          const afterNode = child.node;
        
          const annotationMark = annotationMarkType;
        
          if (afterNode && afterNode.marks.some(mark => mark.type === annotationMark)) {
            const tr = state.tr;
        
            tr.split(pos);
      
            const $newPos = tr.doc.resolve(pos + 1); 
            tr.setSelection(Selection.near($newPos, -1)).setStoredMarks([]);
            dispatch(tr);
            return true;
          } else {
            const $newPos = doc.resolve(pos);
            const tr = state.tr.setSelection(Selection.near($newPos, -1)).setStoredMarks([]);
            dispatch(tr);
            return true;
          }
        }


      }}
  })
}

export function createAnnotationArrowKeyPlugin(schema: Schema) {
  return new PMPlugin({
    key: new PluginKey('annotationArrowKey'),
    props: {
      handleKeyDown(view, event) {
        const { state, dispatch } = view;
        const { selection, doc } = state;
        const annotationMarkType = schema.marks.annotation;

        const { from, empty } = selection;
        if (!empty) return false;

        const pos = from;
        const $pos = doc.resolve(pos);

        const insideAnnotation = $pos.marks().some(m => m.type === annotationMarkType)
          || ($pos.nodeBefore && $pos.nodeBefore.marks.some(m => m.type === annotationMarkType));
        if (!insideAnnotation) return false;

        const { start, end } = getMarkRange(doc, pos, annotationMarkType);

        if (event.key === 'ArrowRight') {
  
          if (pos < end) {
            event.preventDefault();
            const tr = state.tr.setSelection(
              Selection.near(doc.resolve(pos + 1), -1)
            ).setStoredMarks([]);
            dispatch(tr);
            return true;
          }

          if (pos === end) {
            const node = $pos.parent;
            const offset = $pos.parentOffset;
            const child = node.childAfter(offset);
            const afterNode = child.node;

            if (afterNode && afterNode.marks.some(mark => mark.type === annotationMarkType)) {
              let tr = state.tr.split(pos);
              event.preventDefault();
              const $newPos = tr.doc.resolve(pos + 1);
              tr = tr.setSelection(Selection.near($newPos, -1)).setStoredMarks([]);
              dispatch(tr);
              return true;
            } else {
              event.preventDefault();
              const $newPos = doc.resolve(pos + 1);
              const tr = state.tr.setSelection(Selection.near($newPos, -1)).setStoredMarks([]);
              dispatch(tr);
              return true;
            }
          }
          return false;
        }

        if (event.key === 'ArrowLeft') {
          if (pos === start) {
            event.preventDefault();
            const newPos = pos - 1 < 0 ? 0 : pos - 1;
            const $newPos = doc.resolve(newPos);
            const tr = state.tr.setSelection(Selection.near($newPos, 1)).setStoredMarks([]);
            dispatch(tr);
            return true;
          }
          if (pos > start) {
            return false;
          }
        }
        return false;
      }
    }
  });
}

function getMarkRange(doc: ProseMirrorNode, pos: number, markType: MarkType) {
  let start = pos;
  let end = pos;

  console.log(doc, pos, markType)
  while (start > 0) {
    const $start = doc.resolve(start - 1)
    if (!$start.marks().some(mark => mark.type === markType)) break
    start--
  }

  console.log(doc.resolve(end))
  while (end < doc.content.size) {
    const $end = doc.resolve(end)
    if (!$end.marks().some(mark => mark.type === markType)) {
      break
    }
    end++
  }

  end--;
  console.log("start: ", start, "end: ", end)

  return { start, end }
}

