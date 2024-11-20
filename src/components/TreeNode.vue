<template>
  <div v-if="isValidNode" class="tree-node" :class="nodeInfo.type">
    <div class="node-content">
      <div class="node-header">
        <div class="node-title">
          <span class="node-type-badge" :class="nodeInfo.type">
            {{ nodeInfo.type }}
          </span>
          <span class="node-id">{{ nodeInfo.id }}</span>
          <span v-if="nodeInfo.outputKey" class="output-key">
            → {{ nodeInfo.outputKey }}
          </span>
          <span v-if="nodeInfo.output.expectedCount" class="count-badge">
            (count: {{ nodeInfo.output.expectedCount }})
          </span>
        </div>
      </div>

      <!-- Type-specific content -->
      <div class="node-details" v-if="nodeInfo.output">
        <div v-if="nodeInfo.type === 'text-array'" class="array-info">
          <span class="validation">
            min: {{ nodeInfo.output.validation?.minLength || "none" }}
          </span>
        </div>
        <div v-if="nodeInfo.type === 'image'" class="image-info">
          <span class="model">
            {{ nodeInfo.output.model?.quality || "standard" }} quality
          </span>
        </div>

        <div v-if="nodeInfo?.expectedOutputProps?.length" class="object-info">
          Returns:
          <span v-for="prop in nodeInfo.expectedOutputProps" class="tag">
            {{ prop }}
          </span>
        </div>
        <div v-if="nodeInfo.type === 'object'" class="object-info">
          <span
            v-if="nodeInfo.output.validation?.required?.length"
            class="required"
          >
            Required: {{ nodeInfo.output.validation.required.join(", ") }}
          </span>
        </div>
      </div>

      <button @click="run(nodeInfo)">RUN {{ nodeInfo.id }}</button>

      / <button @click="console.log(nodeInfo)">Log config</button>

      <!-- Recursively render children -->
      <div v-if="nodeInfo.hasChildren" class="children">
        <TreeNode
          v-for="child in nodeInfo.children"
          :key="child.id"
          :node="child"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { OpenAIClient } from "../adapters/openai.js";
import { ReplicateFluxDev } from "../adapters/replicate.js";
import {
  MockOpenAIClient,
  MockReplicateClient,
} from "../adapters/mockClients.js";
import { ProcessTree } from "../core/processTree";

import { useRunStore } from "../stores/runStore";
const runStore = useRunStore();

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
});

const nodeInfo = computed(() => props.node || {});
const isValidNode = computed(() => props.node && props.node.isValidNode);
const loading = ref(false);
const error = ref(null);

const createProcessor = (opt) => {
  const textAdapter = opt.mockText
    ? new MockOpenAIClient()
    : new OpenAIClient();
  const imageAdapter = opt.mockImage
    ? new MockReplicateClient()
    : new ReplicateFluxDev();

  return new ProcessTree({
    textAdapter,
    imageAdapter,
    mock: false,
  });
};

const run = async (node) => {
  loading.value = true;
  error.value = null;

  try {
    console.log("Running node", node.id);
    const processor = createProcessor({ mockText: false, mockImage: true }); // Set to false for production
    const result = await processor.process(node, { year: 2024 });
    console.log(`Node ${node.id} result:`, result);
    //log json too

    console.log(`Node ${node.id} result:`, JSON.stringify(result));

    console.log(`Node ${node.id} result:`, JSON.stringify(result, 0, 2));

    // Add to run store
    runStore.addRun(node.id, node, result);

    return result;
  } catch (err) {
    error.value = err.message;
    console.error(`Error running node ${node.id}:`, err);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.tag {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  margin-right: 8px;
  background: #f0f0f0;
  color: #666;
}
.tree-node {
  margin: 8px 0;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.node-type-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  margin-right: 8px;
}

.text-array .node-type-badge {
  background: #e6f3ff;
  color: #0066cc;
}

.image .node-type-badge {
  background: #f0f7f0;
  color: #2d862d;
}

.object .node-type-badge {
  background: #fff3e6;
  color: #cc7700;
}

.children {
  margin-left: 20px;
  padding-left: 10px;
  border-left: 1px dashed #ddd;
}

.node-details {
  font-size: 0.9em;
  color: #666;
  margin-top: 4px;
}
</style>
