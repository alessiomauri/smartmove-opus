'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Search, Plus, X, GripVertical } from 'lucide-react';
import { Property } from '@/types/property';
import { createClient } from '@/lib/supabase';
import { formatPrice, cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CollectionPropertyPickerProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

function SortablePropertyItem({
  property,
  onRemove,
}: {
  property: Property;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 group',
        isDragging && 'shadow-lg border-[#0f6c74]/30 z-10 relative'
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="relative w-14 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
        <Image
          src={property.hero_image}
          alt={property.name}
          fill
          className="object-cover"
          sizes="56px"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{property.name}</p>
        <p className="text-xs text-gray-500">{property.location}</p>
      </div>

      <p className="text-xs font-medium text-gray-600 flex-shrink-0 hidden sm:block">
        {formatPrice(property.price, property.price_on_request)}
      </p>

      <button
        type="button"
        onClick={onRemove}
        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function CollectionPropertyPicker({
  selectedIds,
  onSelectionChange,
}: CollectionPropertyPickerProps) {
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch all published properties
  useEffect(() => {
    const fetchProperties = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (data) {
        setAllProperties(data as Property[]);
      }
      setLoading(false);
    };
    fetchProperties();
  }, []);

  // Sync selected properties when allProperties or selectedIds change
  useEffect(() => {
    if (allProperties.length === 0) return;
    const ordered = selectedIds
      .map((id) => allProperties.find((p) => p.id === id))
      .filter(Boolean) as Property[];
    setSelectedProperties(ordered);
  }, [allProperties, selectedIds]);

  const availableProperties = allProperties.filter(
    (p) =>
      !selectedIds.includes(p.id) &&
      (search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.location.toLowerCase().includes(search.toLowerCase()))
  );

  const addProperty = (property: Property) => {
    const newIds = [...selectedIds, property.id];
    onSelectionChange(newIds);
  };

  const removeProperty = (propertyId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== propertyId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = selectedIds.indexOf(active.id as string);
    const newIndex = selectedIds.indexOf(over.id as string);
    const newOrder = arrayMove(selectedIds, oldIndex, newIndex);
    onSelectionChange(newOrder);
  };

  return (
    <div className="space-y-4">
      {/* Selected Properties — Sortable */}
      {selectedProperties.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Properties ({selectedProperties.length})
          </label>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {selectedProperties.map((property) => (
                  <SortablePropertyItem
                    key={property.id}
                    property={property}
                    onRemove={() => removeProperty(property.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <p className="text-xs text-gray-400 mt-2">Drag to reorder</p>
        </div>
      )}

      {/* Search and Add */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add Properties
        </label>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
          />
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin w-5 h-5 border-2 border-[#0f6c74] border-t-transparent rounded-full mx-auto" />
          </div>
        ) : availableProperties.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {search ? 'No matching properties found' : 'All properties have been added'}
          </p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {availableProperties.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={() => addProperty(property)}
                className="flex items-center gap-3 w-full p-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="relative w-12 h-9 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                  <Image
                    src={property.hero_image}
                    alt={property.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{property.name}</p>
                  <p className="text-xs text-gray-500">{property.location}</p>
                </div>

                <p className="text-xs text-gray-500 flex-shrink-0 hidden sm:block">
                  {formatPrice(property.price, property.price_on_request)}
                </p>

                <Plus className="w-4 h-4 text-[#0f6c74] flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
