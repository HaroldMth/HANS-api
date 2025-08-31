import { Suspense } from 'react';
import { Folder, Grid3X3 } from 'lucide-react';
import { getCategories } from '@/lib/api';
import CategoriesClient from './CategoriesClient';

async function CategoriesData() {
  try {
    const response = await getCategories();
    const categories = response.data || {};
    return <CategoriesClient initialCategories={categories} />;
  } catch (error) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load categories</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
}

export default function CategoriesPage() {
  return (
    <div className="min-h-screen gradient-bg py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl lg:text-4xl font-bold gradient-text mb-4">
            API Categories
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore our APIs — params auto-attached when available.
          </p>
        </div>

        <Suspense fallback={
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        }>
          <CategoriesData />
        </Suspense>
      </div>
    </div>
  );
}