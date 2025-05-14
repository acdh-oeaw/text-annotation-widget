import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import { createApp, ref } from 'vue'

import type { Entity } from '@/types.ts'

import ProseMirrorEditor from './components/prose-mirror-editor.vue'

const sampleData = [{ id: 1, name: 'Church' }];

createTextAnnotationApp({ linkedEntities: sampleData, sourceText: '' })

export function createTextAnnotationApp({ linkedEntities = [], sourceText = '' }: { linkedEntities: Array<Entity>; sourceText: string }) {
  const app = createApp({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    components: { ProseMirrorEditor },
    setup() {
      const linkedEntitiesRef = ref(linkedEntities)
      const sourceTextRef = ref(sourceText)

      return {
        linkedEntities: linkedEntitiesRef,
        sourceText: sourceTextRef,
      }
    },
    template: `
      <div>
        <ProseMirrorEditor
          :linked-entities="linkedEntities"
          :source-text="sourceText"
        />
      </div>
    `,
  })

  console.log('Vue App created, mounting...')
  app.mount('#app')
  return app
}
