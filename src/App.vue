<script setup>
//computed
import { computed } from "vue";
import HelloWorld from "./components/HelloWorld.vue";
import TreeNode from "./components/TreeNode.vue";

import { myTree, projectConfig } from "./tree1.js";

import { loadTree, loadFullTree } from "./core/loadTree";

const processedTree = loadFullTree(myTree);

import { useRunStore } from "./stores/runStore";
const runStore = useRunStore();

const outputTypes = [
  { value: "input", label: "Input" },
  { value: "output", label: "Raw Output" },
  { value: "cleanOutput", label: "Clean Output" },
];

// Let runStore handle selected output type
const selectedOutputType = computed({
  get: () => runStore.selectedOutputType,
  set: (value) => runStore.setSelectedOutputType(value),
});
</script>

<template>
  <div class="app-container" style="text-align: left">
    <!-- Left side: Tree -->
    <div class="tree-panel">
      <TreeNode
        :tree="processedTree"
        :node="processedTree"
        :projectConfig="projectConfig"
      />
    </div>

    <!-- Right side: Output -->
    <div class="output-panel">
      <div class="output-controls">
        <select v-model="selectedOutputType">
          <option
            v-for="type in outputTypes"
            :key="type.value"
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select>
      </div>

      <JsonViewer
        :value="runStore.selectedRun?.[selectedOutputType]"
        copyable
        sort
        theme="jv-dark"
      />

      <div v-if="runStore.selectedRun" class="run-output">
        <div class="summary">{{ runStore.formattedOutput?.summary }}</div>
        <pre class="output">{{ runStore.formattedOutput?.formatted }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: grid;
  grid-template-columns: 1fr 1fr; /* Equal width columns */
  gap: 2rem;
  padding: 1rem;
  height: 100vh;
  overflow: hidden;
}

.tree-panel {
  overflow-y: auto;
  padding-right: 1rem;
  border-right: 1px solid #333;
}

.output-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.output-controls {
  position: sticky;
  top: 0;
  background: var(--background-color);
  padding: 1rem 0;
  z-index: 10;
}

.output-controls select {
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #444;
  background: #222;
  color: #fff;
  width: 200px;
}

.run-output {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 1rem;
}

.summary {
  color: #888;
  margin-bottom: 0.5rem;
}

.output {
  font-family: monospace;
  white-space: pre-wrap;
  margin: 0;
}
</style>
