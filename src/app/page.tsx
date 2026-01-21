export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Slack Accountant Referral System
          </h1>
          <p className="text-slate-400 text-lg">
            Streamline your accountant referral workflow with Slack and Microsoft 365
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="font-semibold text-lg mb-2">#accountant-referral</h3>
            <p className="text-slate-400 text-sm">
              Brokers submit new client referrals via an interactive form
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-3xl mb-3">📅</div>
            <h3 className="font-semibold text-lg mb-2">Calendar + Excel</h3>
            <p className="text-slate-400 text-sm">
              Appointments auto-created, referrals tracked in spreadsheet
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-3xl mb-3">✅</div>
            <h3 className="font-semibold text-lg mb-2">#accounting-admin</h3>
            <p className="text-slate-400 text-sm">
              React with checkmark to mark invoices as paid
            </p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="font-semibold text-xl mb-4">System Status</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">API Health:</span>
              <a href="/api/health" className="text-blue-400 hover:underline">/api/health</a>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Slack Interactions:</span>
              <span className="text-green-400">/api/slack/interactions</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Slack Events:</span>
              <span className="text-green-400">/api/slack/events</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Powered by Next.js, Slack Bolt, and Microsoft Graph</p>
        </div>
      </div>
    </main>
  );
}
