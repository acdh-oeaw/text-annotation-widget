<script setup lang="ts">
import '../assets/editor-pop-up.css'

import { ref,watch  } from 'vue';

import type { Annotation, Entity } from '../types'

// Props for linked entities
const props = defineProps<{
  entities: Array<Entity>
  triggerAnnotation: boolean
  annotation?: Annotation
}>()
const emit = defineEmits(['add-annotation', 'cancel-annotation', 'edit-annotation'])

const addDisabled = ref(true)
const dialogOpen = ref(false)
const entityId = ref<string | undefined>(undefined)
const comment = ref<string | undefined>('')
const currentEditAnnotation = ref<Annotation | undefined>(undefined)

watch(
  () => props.triggerAnnotation,
  (newVal: boolean) => {
    dialogOpen.value = newVal
  },
)

watch(
  () => props.annotation,
  (newVal: Annotation | undefined) => {
    currentEditAnnotation.value = newVal
    if (currentEditAnnotation.value) {
      entityId.value = currentEditAnnotation.value.entityId
      comment.value = currentEditAnnotation.value.comment
    }
  },
)

watch([entityId, comment], () => {
  addDisabled.value = !(entityId.value != null || comment.value !== '')
})

const handleAdd = () => {
  emit('add-annotation', {
    annotationId: crypto.randomUUID(),
    entityId: entityId.value,
    comment: comment.value,
  })
  entityId.value = undefined
  comment.value = ''
}

const handleCancel = () => {
  emit('cancel-annotation')
  entityId.value = undefined
  comment.value = ''
}

const handleEdit = () => {
  emit('edit-annotation', {
    entityId: entityId.value,
    comment: comment.value,
  })
  entityId.value = undefined
  comment.value = ''
}
</script>

<template>
  <div v-if="dialogOpen" class="modal d-block" role="dialog" tabindex="-1">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            {{ props.annotation ? 'Edit Annotation' : 'Add Annotation' }}
          </h5>
          <button
            aria-label="Close"
            class="btn-close"
            type="button"
            @click="handleCancel()"
          ></button>
        </div>

        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label" for="linked-entities">Linked Entities</label>
            <select id="linked-entities" v-model="entityId" class="form-select" required>
              <option disabled value="">Link an entity</option>
              <option v-for="entity in props.entities" :key="entity.id" :value="entity.id">
                {{ entity.name }}
              </option>
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label" for="comment">Comment</label>
            <textarea
              id="comment"
              v-model="comment"
              class="form-control"
              placeholder="Add comment"
              rows="4"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" type="button" @click="handleCancel()">Cancel</button>
          <button
            v-if="!currentEditAnnotation"
            class="btn btn-primary"
            :disabled="addDisabled"
            type="button"
            @click="handleAdd()"
          >
            Add
          </button>
          <button
            v-else
            class="btn btn-primary"
            :disabled="addDisabled"
            type="button"
            @click="handleEdit()"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="dialogOpen" class="modal-backdrop fade" :class="{ show: dialogOpen }"></div>
</template>
