'use client';

import Image from 'next/image';
import { GripVertical, X } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type RankItem = {
  id: string;            // stable sortable id (property id, or curated_list_items id)
  title: string;
  subtitle?: string;
  price?: number | null;
  price_on_request?: boolean;
  image?: string;
};

function Row({ item, index, onRemove }: { item: RankItem; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} data-rankrow={item.id}
      className={cn('flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2.5', isDragging && 'shadow-lg border-[#0f6c74]/30 z-10 relative')}>
      <button type="button" data-grip="" className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-xs font-bold text-gray-400 w-5 text-center">{index + 1}</span>
      <div className="relative w-12 h-9 rounded overflow-hidden bg-gray-100 shrink-0">
        {item.image && <Image src={item.image} alt="" fill className="object-cover" sizes="48px" unoptimized />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
        {item.subtitle && <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>}
      </div>
      {item.price !== undefined && (
        <p className="text-xs text-gray-600 hidden sm:block">{formatPrice(item.price ?? null, item.price_on_request ?? false)}</p>
      )}
      <button type="button" onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded shrink-0" title="Remove">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function DragRankList({
  items, onReorder, onRemove, emptyText,
}: {
  items: RankItem[];
  onReorder: (orderedIds: string[]) => void;
  onRemove: (id: string) => void;
  emptyText?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  if (!items.length) return <p className="text-sm text-gray-400 py-3">{emptyText ?? 'Nothing here yet.'}</p>;
  const ids = items.map((i) => i.id);
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string)));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((it, i) => <Row key={it.id} item={it} index={i} onRemove={() => onRemove(it.id)} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}
