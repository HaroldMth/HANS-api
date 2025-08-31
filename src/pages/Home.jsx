import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Shield, BarChart3, Globe } from 'lucide-react';
import { getCategories } from '../api.js';
import EndpointExplorer from '../components/EndpointExplorer.jsx';

const Home = () => {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        setCategories(response.data || {});
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const features = [
    {
      icon: <Zap className="h-8 w-8" />,
      title: 'Fast & Reliable',
      description: 'Lightning-fast API responses with 99.9% uptime guarantee',
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: 'Secure Access',
      description: 'Enterprise-grade security with API key authentication',
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: 'Usage Analytics',
      description: 'Detailed analytics and usage tracking for all endpoints',
    },
  ];

  const sampleEndpoints = Object.entries(categories).slice(0, 3).map(([categoryName, endpoints]) => ({
    category: categoryName,
    endpoint: endpoints[0]?.endpoint,
    description: endpoints[0]?.description,
  })).filter(item => item.endpoint);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Welcome to HANS API
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            Your comprehensive API service platform. Access powerful endpoints, manage your usage, 
            and integrate seamlessly with enterprise-grade reliability and security.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
            >
              <span>Get Started</span>
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/categories"
              className="bg-white text-purple-600 px-8 py-4 rounded-xl font-semibold hover:bg-purple-50 transition-all border border-purple-200 hover:border-purple-300 shadow-md hover:shadow-lg"
            >
              Explore APIs
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Choose HANS API?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built for developers who demand excellence, reliability, and ease of use
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="text-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border border-purple-100"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Endpoints Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Explore Our Endpoints
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Try out our API endpoints right from your browser
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {sampleEndpoints.map((item, index) => (
                <EndpointExplorer
                  key={index}
                  endpoint={item.endpoint}
                  description={item.description}
                  category={item.category}
                />
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              to="/categories"
              className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-semibold hover:underline"
            >
              <Globe size={20} />
              <span>View All Categories</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join thousands of developers already using HANS API for their projects
          </p>
          <Link
            to="/register"
            className="bg-white text-purple-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center space-x-2"
          >
            <span>Start Building Today</span>
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;