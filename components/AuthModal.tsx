import React, { useState, useRef } from 'react';
import {
  X,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Smartphone,
  LogIn,
  Camera,
  AtSign,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { AuthUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { compressImageDataUrl } from '../utils/storageUtils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (user: AuthUser) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const { saveProfileAndEnter, signInWithGoogle, isSupabaseConnected } = useAuth();
  const [authMethod, setAuthMethod] = useState<'phone' | 'gmail'>('gmail');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [fullName, setFullName] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_PRESETS[0]);
  const [gmailEmail, setGmailEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const raw = reader.result as string;
        const compressed = await compressImageDataUrl(raw, 250, 250, 0.75);
        setSelectedAvatar(compressed);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Failed to load avatar:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (authMethod === 'phone') {
      if (!phoneNumber.trim() || phoneNumber.trim().length < 6) {
        setErrorMsg('Please enter a valid mobile phone number.');
        return;
      }
    } else {
      if (!gmailEmail.trim() || !gmailEmail.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
    }

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name or creator display name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const identifier = authMethod === 'phone'
        ? `${phoneCountryCode} ${phoneNumber.trim()}`
        : gmailEmail.trim();

      const result = await saveProfileAndEnter({
        authMethod,
        identifier,
        fullName: fullName.trim(),
        username: customUsername.trim() || undefined,
        avatar: selectedAvatar,
        password: password.trim() || undefined,
      });

      setIsSubmitting(false);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      onAuthSuccess?.(result.user);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Authentication failed. Please check network connection.');
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle({
        email: gmailEmail.trim() || undefined,
        fullName: fullName.trim() || undefined,
        avatar: selectedAvatar,
      });
      setIsGoogleLoading(false);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }
      if (result.user) {
        onAuthSuccess?.(result.user);
        onClose();
      }
      // If OAuth redirect URL returned, browser redirects automatically
    } catch (err: any) {
      setIsGoogleLoading(false);
      setErrorMsg(err?.message || 'Failed to initialize Google sign in.');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-purple-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto text-slate-900"
      >
        {/* Glow Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-teal-400 to-pink-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Metfa Social"
              className="w-10 h-10 min-w-[40px] max-w-[40px] min-h-[40px] max-h-[40px] rounded-2xl shadow-md object-cover block shrink-0 pointer-events-none"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/metfa-emblem.png';
              }}
            />
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>Join Metfa Social</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">Single Account for AI Studio & Social Media</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar Picker / Upload */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-4">
          <div className="relative shrink-0 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img
              src={selectedAvatar}
              alt="Avatar Preview"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-500/50 shadow-md"
            />
            <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFile}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-800">Profile Photo</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-bold text-purple-600 hover:text-purple-700 transition"
              >
                Upload Photo
              </button>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedAvatar(preset)}
                  className={`w-7 h-7 rounded-xl overflow-hidden border transition shrink-0 ${
                    selectedAvatar === preset ? 'border-teal-500 ring-2 ring-teal-400/40' : 'border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs: Gmail vs Mobile Phone */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('gmail');
              setErrorMsg('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              authMethod === 'gmail'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Gmail / Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMethod('phone');
              setErrorMsg('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              authMethod === 'phone'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile Phone</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Full Name / Display Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Elena Rostova or Alex Rivera"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Custom Username (Optional)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customUsername}
                onChange={(e) => setCustomUsername(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                placeholder="e.g. elena_ai or alex.creative"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          {authMethod === 'phone' ? (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Mobile Phone Number
              </label>
              <div className="flex gap-2">
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+880">🇧🇩 +880</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+81">🇯🇵 +81</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+86">🇨🇳 +86</option>
                </select>

                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="1712 345678"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white font-medium"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={gmailEmail}
                  onChange={(e) => setGmailEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white font-medium"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
              <span>Account Password</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional (auto-secured)</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password for multi-device access"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isGoogleLoading}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 via-purple-500 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer mt-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Profile & Entering Metfa...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Save Profile & Enter Metfa</span>
              </>
            )}
          </button>

          {/* Google OAuth Section */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="bg-white px-2 text-slate-500 font-semibold">Or Continue With</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span>Connecting with Google OAuth...</span>
              </>
            ) : (
              <>
                <img
                  src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
                  alt="Google"
                  className="w-4 h-4 object-contain"
                />
                <span>Instant Sign in with Google</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>{isSupabaseConnected ? 'Persistent Supabase Cloud Auth & Database' : 'Secure local creator profile'}</span>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
