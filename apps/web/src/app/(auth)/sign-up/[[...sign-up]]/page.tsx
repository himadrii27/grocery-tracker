import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-green-100 px-4 py-8">
      <div className="text-center w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-700 mb-2">🛒 Grocery Tracker</h1>
        <p className="text-gray-500 mb-8 text-sm md:text-base">Start tracking your groceries</p>
        <div className="flex justify-center">
          <SignUp />
        </div>
      </div>
    </div>
  );
}
