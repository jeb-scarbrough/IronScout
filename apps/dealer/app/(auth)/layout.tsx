export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            🎯 IronScout
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Dealer Portal
          </p>
        </div>
        
        {children}
      </div>
    </div>
  );
}
