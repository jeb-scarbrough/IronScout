import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ironscout/db';
import { Code, Copy, RefreshCw, CheckCircle } from 'lucide-react';
import { PixelActions } from './pixel-actions';

export default async function PixelSettingsPage() {
  const session = await getSession();
  
  if (!session || session.type !== 'merchant') {
    redirect('/login');
  }
  
  const merchant = await prisma.merchants.findUnique({
    where: { id: session.merchantId },
    select: {
      id: true,
      pixelApiKey: true,
      pixelEnabled: true,
    },
  });

  if (!merchant) {
    redirect('/login');
  }

  const pixelCode = merchant.pixelApiKey ? `
<!-- IronScout Revenue Tracking Pixel -->
<script>
  window.ironscout = window.ironscout || { track: function() { (window.ironscout.q = window.ironscout.q || []).push(arguments); } };
</script>
<script async src="https://pixel.ironscout.ai/v1/pixel.js"></script>

<!-- Place this on your order confirmation page -->
<script>
  ironscout.track('purchase', {
    key: '${merchant.pixelApiKey}',
    orderId: 'YOUR_ORDER_ID',      // Required: Unique order identifier
    orderValue: 123.45,            // Required: Total order value in USD
    skus: [                        // Optional: Array of purchased SKUs
      { sku: 'SKU123', qty: 2, price: 45.99 },
      { sku: 'SKU456', qty: 1, price: 31.47 }
    ]
  });
</script>
`.trim() : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pixel Setup</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add the IronScout pixel to track revenue attribution from our platform
        </p>
      </div>

      {/* Status */}
      <div className={`rounded-lg p-4 ${merchant.pixelEnabled ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center gap-3">
          {merchant.pixelEnabled ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Pixel is active</p>
                <p className="text-sm text-green-700">Revenue tracking is enabled for your account.</p>
              </div>
            </>
          ) : (
            <>
              <Code className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Pixel not set up</p>
                <p className="text-sm text-yellow-700">Add the pixel code to your checkout page to track conversions.</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* API Key */}
      <div className="rounded-lg bg-white shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">
            Your Pixel API Key
          </h3>
          
          <PixelActions
            merchantId={merchant.id}
            apiKey={merchant.pixelApiKey}
            pixelEnabled={merchant.pixelEnabled}
          />
        </div>
      </div>

      {/* Code Snippet */}
      {merchant.pixelApiKey && (
        <div className="rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">
              Integration Code
            </h3>
            
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                <code>{pixelCode}</code>
              </pre>
            </div>
            
            <div className="mt-4 text-sm text-gray-600">
              <h4 className="font-medium text-gray-900 mb-2">Integration Steps:</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copy the code snippet above</li>
                <li>Add the first script tag to all pages (or your checkout flow)</li>
                <li>Add the purchase tracking call to your order confirmation page</li>
                <li>Replace <code className="bg-gray-100 px-1 rounded">YOUR_ORDER_ID</code> with your actual order ID</li>
                <li>Replace the <code className="bg-gray-100 px-1 rounded">orderValue</code> with the actual order total</li>
                <li>Optionally include the SKU details for better attribution</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <h4 className="font-medium text-blue-800">How Revenue Attribution Works</h4>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
          <li>When a user clicks through from IronScout, we track the session</li>
          <li>The pixel fires on your order confirmation page with the order details</li>
          <li>We use 24-hour last-click attribution to credit the conversion</li>
          <li>All data is anonymized and only aggregate metrics are shared</li>
        </ul>
      </div>
    </div>
  );
}
