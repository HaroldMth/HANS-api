// Categories.jsx
import React, { useState, useEffect } from 'react';
import { Folder, Grid3X3 } from 'lucide-react';
import { getCategories } from '../api.js';
import EndpointExplorer from '../components/EndpointExplorer.jsx';

const Categories = () => {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [apiListMap, setApiListMap] = useState({}); // name -> params

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 1) fetch categories (existing helper)
        const res = await getCategories();
        const cats = res.data || {};
        setCategories(cats);

        // 2) attempt to fetch /user/api-list to map params (best-effort)
        try {
          const url = `${import.meta.env.VITE_API_BASE_URL}/user/api-list`;
          const headers = {};
          const token = localStorage.getItem('token');
          if (token) headers.Authorization = 'Bearer ' + token;

          const listRes = await fetch(url, { headers });
          if (listRes.ok) {
            const listJson = await listRes.json();
            if (listJson?.status === 'success' && Array.isArray(listJson.data)) {
              const map = {};
              listJson.data.forEach((item) => {
                if (item?.name) map[item.name] = item.params || [];
              });
              setApiListMap(map);
            }
          }
        } catch (err) {
          console.warn('Could not fetch /user/api-list', err);
        }

        const firstCategory = Object.keys(cats || {})[0];
        if (firstCategory) setSelectedCategory(firstCategory);
      } catch (err) {
        console.error(err);
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
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

  const categoryEntries = Object.entries(categories);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            API Categories
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore our APIs — params auto-attached when available.
          </p>
        </div>

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

                {/* grid: still defined with 2 cols on xl, but each item below spans both columns */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {categories[selectedCategory]?.map((ep, index) => {
                    // Defensive: server may send different shapes.
                    const path = ep.endpoint || ep.path || (ep.name ? `/${ep.name}` : '/');
                    const description = ep.description || ep.desc || '';
                    // derive api module name to lookup params: try ep.name; if not, take last path segment
                    let moduleName = ep.name;
                    if (!moduleName) {
                      const seg = (path || '').replace(/^\/+/, '').split('/');
                      moduleName = seg[seg.length - 1] || '';
                    }
                    const autoParams = apiListMap[moduleName] || [];
                    const useParams = ep.params && ep.params.length ? ep.params : autoParams;

                    // MAKE CARD TAKE FULL ROW ON XL (col-span-2)
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
      </div>
    </div>
  );
};

export default Categories;
