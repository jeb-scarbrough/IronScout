export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center flex flex-col items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="48"
            height="48"
            className="mb-4"
          >
            <path
              d="M50 5 L89 27.5 V72.5 L50 95 L11 72.5 V27.5 Z"
              fill="none"
              stroke="#00C2CB"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <g transform="translate(50,50)">
              <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" fill="none" stroke="#00C2CB" strokeWidth="2" transform="rotate(0)"/>
              <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" fill="none" stroke="#00C2CB" strokeWidth="2" transform="rotate(60)"/>
              <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" fill="none" stroke="#00C2CB" strokeWidth="2" transform="rotate(120)"/>
              <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" fill="none" stroke="#00C2CB" strokeWidth="2" transform="rotate(180)"/>
              <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" fill="none" stroke="#00C2CB" strokeWidth="2" transform="rotate(240)"/>
              <path d="M0 -30 Q15 -30 22 -10 L0 0 Z" fill="none" stroke="#00C2CB" strokeWidth="2" transform="rotate(300)"/>
            </g>
            <circle cx="50" cy="50" r="12" fill="#00C2CB"/>
            <circle cx="82" cy="18" r="4" fill="#00C2CB"/>
          </svg>
          <h1 className="text-3xl font-bold text-gray-900">
            IronScout
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
