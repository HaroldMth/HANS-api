'use client';

import { useState, useEffect } from 'react';
import { Folder, Grid3X3 } from 'lucide-react';
import EndpointExplorer from '@/components/EndpointExplorer';

interface CategoriesClientProps {
  initialCategories: Record<string, any[]>;
}

export default function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const [categories] = useState(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [apiListMap, setApiListMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchApiList = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = 'Bearer ' + token;

        const listRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/user/api-list`, { headers });
        if (listRes.ok) {
          const listJson = await listRes.json();
          if (listJson?.status === 'success' && Array.isArray(listJson.data)) {
            const map: Record<string, any[]> = {};
            listJson.data.forEach((item: any) => {
              if (item?.name) map[item.name] = item.params || [];
            });
            setApiListMap(map);
          }
        }
      } catch (err) {
        console.warn('Could not fetch /user/api-list', err);
      }
    };

    fetchApiList();
    
    const firstCategory = Object.keys(categories || {})[0];
    if (firstCategory) setSelectedCategory(firstCategory);
  }, [categories]);

  const categoryEntries = Object.entries(categories);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="lg:w-1/4">
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Folder className="h-5 w-5 mr-2" />
              Categories
            </h2>
          </div>
          <div className="p-2">
            {categoryEntries.map(([categoryName, endpoints]) => (
              <button
                key={categoryName}
                onClick={() => setSelectedCategory(categoryName)}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
                  selectedCategory === categoryName
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{categoryName}</span>
                  <span className="text-sm opacity-75">
                    {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:w-3/4">
        {selectedCategory ? (
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Grid3X3 className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedCategory}</h2>
              <span className="text-sm text-gray-500">{categories[selectedCategory]?.length} endpoints</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {categories[selectedCategory]?.map((ep: any, index: number) => {
                const path = ep.endpoint || ep.path || (ep.name ? `/${ep.name}` : '/');
                const description = ep.description || ep.desc || '';
                let moduleName = ep.name;
                if (!moduleName) {
                  const seg = (path || '').replace(/^\/+/, '').split('/');
                  moduleName = seg[seg.length - 1] || '';
                }
                const autoParams = apiListMap[moduleName] || [];
                const useParams = ep.params && ep.params.length ? ep.params : autoParams;

                return (
                  <div key={index} className="col-span-1 xl:col-span-2">
                    <EndpointExplorer
                      endpoint={path}
                      description={description}
                      category={selectedCategory}
                      params={useParams}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-purple-100">
            <Folder className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Category</h3>
            <p className="text-gray-600">Choose a category from the sidebar to explore available endpoints</p>
          </div>
        )}
      </div>
    </div>
  );
}