import { type NextPage } from 'next';

// This is a placeholder for a new custom promotional landing page.
// Implement your unique layout and content here.
const PromoLander: NextPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
      <h1 className="text-6xl font-bold text-indigo-600 mb-4">
        🚀 Exclusive Launch Page
      </h1>
      <p className="text-xl text-gray-600 max-w-xl text-center">
        Welcome to our exclusive promotional landing experience! This page features a unique layout different from the standard landing page.
      </p>
      <button className="mt-8 px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
        Start Dashboard
      </button>
    </div>
  );
};

export default PromoLander;