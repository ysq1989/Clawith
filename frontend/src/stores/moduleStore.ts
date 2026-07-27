/** Module access store — manages tenant-level module visibility. */

import { create } from 'zustand';
import { fetchJson } from '../services/api';

export type ModuleID = 'agent' | 'erp' | 'xhs' | 'product_hub';

export interface ModuleInfo {
    label: string;
    label_zh?: string;
    icon: string;
    path: string;
    required: boolean;
}

interface ModuleStore {
    modules: ModuleID[];
    registry: Record<string, ModuleInfo>;
    loaded: boolean;
    fetchModules: () => Promise<void>;
    hasModule: (id: ModuleID) => boolean;
}

export const useModuleStore = create<ModuleStore>((set, get) => ({
    modules: [],
    registry: {} as Record<string, ModuleInfo>,
    loaded: false,

    fetchModules: async () => {
        try {
            const res = await fetchJson<{ modules: ModuleID[]; registry: Record<string, ModuleInfo> }>('/auth/my-modules');
            set({
                modules: res.modules ?? [],
                registry: res.registry ?? {},
                loaded: true,
            });
        } catch {
            // On error, default to all modules enabled (backward compat)
            set({
                modules: ['agent', 'erp', 'xhs', 'product_hub'],
                registry: {},
                loaded: true,
            });
        }
    },

    hasModule: (id) => {
        const { modules } = get();
        return modules.includes(id);
    },
}));
