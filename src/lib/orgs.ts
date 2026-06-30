import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useCachedQuery } from "@/lib/local-cache";

export type Battalion = Tables<"battalions">;
export type Company = Tables<"companies">;
export type Department = Tables<"departments">;

export function useDepartments() {
  return useCachedQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Department[];
    },
  });
}

export function useBattalions() {
  return useCachedQuery<Battalion[]>({
    queryKey: ["battalions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battalions")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Battalion[];
    },
  });
}

export function useCompanies() {
  return useCachedQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Company[];
    },
  });
}
