import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook for managing favourites (thumbs-up) state per node.
 * Loads saved favourites on mount, provides toggle function that persists to DB.
 */
export function useFavourites(nodeId: string) {
  const [favourited, setFavourited] = useState<Set<number>>(new Set());
  const { data } = trpc.favourites.getByNode.useQuery({ nodeId }, { enabled: !!nodeId });
  const addMutation = trpc.favourites.add.useMutation();
  const removeMutation = trpc.favourites.remove.useMutation();

  useEffect(() => {
    if (data) {
      setFavourited(new Set(data.map((f: any) => f.itemIndex)));
    }
  }, [data]);

  const toggle = (itemIndex: number, itemText?: string) => {
    if (favourited.has(itemIndex)) {
      setFavourited(prev => { const n = new Set(prev); n.delete(itemIndex); return n; });
      removeMutation.mutate({ nodeId, itemIndex });
    } else {
      setFavourited(prev => new Set(prev).add(itemIndex));
      addMutation.mutate({ nodeId, itemIndex, itemText });
    }
  };

  const isFavourited = (itemIndex: number) => favourited.has(itemIndex);

  return { isFavourited, toggle };
}
