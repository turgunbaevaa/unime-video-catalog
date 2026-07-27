"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // We generate a fake login and redirect the user to the home page if the operation is successful
    await signIn("credentials", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900 mb-2">
          UniMe <span className="text-gray-400 font-normal">Catalog</span>
        </h1>
        <h2 className="text-center text-sm text-gray-500">
          Faculty Video Management System
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl border border-gray-200 sm:px-10">
          
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="text-sm font-medium text-amber-800 mb-1">Development Mode</h3>
            <p className="text-xs text-amber-700 leading-relaxed">
              Azure AD authentication is currently bypassed. Click the button below to sign in instantly with administrator privileges.
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Login as Administrator"}
          </button>
        </div>
      </div>
    </div>
  );
}