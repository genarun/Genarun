// stores/runStore.js
import { defineStore } from "pinia";
import { computed } from "vue";

import { cleanOutput } from "../core/cleanOutput";

export const useRunStore = defineStore("runs", {
  state: () => ({
    runs: [],
    selectedRunId: null,
    selectedOutputType: "cleanOutput",
  }),

  actions: {
    addRun(nodeId, input, output) {
      const run = {
        id: Date.now(),
        nodeId,
        timestamp: new Date(),
        input,
        output,
      };

      run.cleanOutput = cleanOutput(run.output);

      this.runs.push(run);
      this.selectedRunId = run.id;
    },

    selectRun(runId) {
      this.selectedRunId = runId;
    },
    setSelectedOutputType(type) {
      this.selectedOutputType = type;
    },
  },

  getters: {
    selectedRun: (state) => {
      return state.runs.find((r) => r.id === state.selectedRunId);
    },

    formattedOutput: (state) =>
      computed(() => {
        const run = state.runs.find((r) => r.id === state.selectedRunId);
        if (!run?.output) return null;

        return {
          raw: run.output,
          formatted: JSON.stringify(run.output, null, 2),
          summary:
            typeof run.output === "object"
              ? Object.keys(run.output).length + " properties"
              : String(run.output).substring(0, 100),
        };
      }),
  },
});
