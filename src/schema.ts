import { Schema, type NodeSpec, type MarkSpec } from 'prosemirror-model'
import { Slice, Fragment } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import { undo, redo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { history } from 'prosemirror-history'

import { Plugin as PMPlugin, PluginKey } from 'prosemirror-state'

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

export function createPasteNormalizerPlugin(schema: Schema) {
  return new PMPlugin({
    key: new PluginKey('normalizePaste'),
    props: {
      handlePaste(view, event, slice) {
        const lines: string[] = []

        // Combine all block content into lines
        slice.content.forEach(node => {
          if (node.isBlock) {
            lines.push(...node.textContent.split(/\r?\n/).map(l => l.trim()))
          } else {
            lines.push(node.textContent.trim())
          }
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children: any[] = []

        lines.forEach((line, idx) => {
          if (line) {
            children.push(schema.text(line))
          }
          if (idx < lines.length - 1) {
            children.push(schema.nodes.hard_break.create())
          }
        })

        const paragraph = schema.nodes.paragraph.create(null, Fragment.from(children))
        const newSlice = new Slice(Fragment.from(paragraph), 0, 0)

        const tr = view.state.tr.replaceSelection(newSlice)
        view.dispatch(tr)

        return true
      },
    },
  })
}

