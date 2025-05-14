import { history,redo,undo  } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { type MarkSpec,type NodeSpec, Schema } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'


// Define custom annotation mark (MarkSpec)
const annotationMark: MarkSpec = {
  attrs: {
    meta: { default: null },
  },
  toDOM: (mark) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
const marks = {
  ...basicSchema.spec.marks.toObject(),
  annotation: annotationMark,
}

const nodes: Record<string, NodeSpec> = {
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
  enterKeymap: keymap({
    Enter: (state, dispatch) => {
      const { $from } = state.selection
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
