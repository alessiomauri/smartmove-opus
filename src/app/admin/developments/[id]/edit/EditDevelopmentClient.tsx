'use client';

import DevelopmentForm from '@/components/admin/DevelopmentForm';
import { updateDevelopment, deleteDevelopment } from '@/lib/actions/developments';
import { Development, DevelopmentInput } from '@/types/development';

export default function EditDevelopmentClient({ development }: { development: Development }) {
  const handleSubmit = async (input: DevelopmentInput) => {
    const updated = await updateDevelopment(development.id, input);
    return { id: updated.id, slug: updated.slug };
  };

  const handleDelete = async () => {
    await deleteDevelopment(development.id);
  };

  return <DevelopmentForm initial={development} onSubmit={handleSubmit} onDelete={handleDelete} />;
}
