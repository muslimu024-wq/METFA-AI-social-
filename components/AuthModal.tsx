import React, { useState, useRef } from 'react';
import {
  X,
  Phone,
  Mail,
  User,
  Sparkles,
  ShieldCheck,
  Check,
  ArrowRight,
  Smartphone,
  Lock,
  Globe,
  LogIn,
  Camera,
  AtSign
} from 'lucide-react';
import { AuthUser } from '../utils/socialStore';
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
  const { loginPhone, loginGmail } = useAuth();
  const [authMethod, setAuthMethod] = useState<'phone' | 'gmail'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [fullName, setFullName] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_PRESETS[0]);
  const [gmailEmail, setGmailEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (authMethod === 'phone') {
      if (!phoneNumber.trim() || phoneNumber.trim().length < 6) {
        setErrorMsg('Please enter a valid mobile phone number.');
        return;
      }
      setIsSubmitting(true);
      try {
        const fullPhone = `${phoneCountryCode} ${phoneNumber.trim()}`;
        const user = loginPhone(
          fullPhone,
          fullName.trim() || 'Mobile Creator',
          customUsername.trim() || undefined,
          selectedAvatar
        );
        setIsSubmitting(false);
        onAuthSuccess?.(user);
        onClose();
      } catch (err: any) {
        setIsSubmitting(false);
        setErrorMsg(err?.message || 'Failed to sign in. Please try again.');
      }
    } else {
      if (!gmailEmail.trim() || !gmailEmail.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      setIsSubmitting(true);
      try {
        const user = loginGmail(
          gmailEmail.trim(),
          fullName.trim() || gmailEmail.split('@')[0],
          selectedAvatar,
          customUsername.trim() || undefined
        );
        setIsSubmitting(false);
        onAuthSuccess?.(user);
        onClose();
      } catch (err: any) {
        setIsSubmitting(false);
        setErrorMsg(err?.message || 'Failed to sign in. Please try again.');
      }
    }
  };

  const handleQuickDemoGmail = () => {
    setIsSubmitting(true);
    try {
      const user = loginGmail(
        'creator@metfa.ai',
        fullName.trim() || 'Metfa Creator',
        selectedAvatar,
        customUsername.trim() || undefined
      );
      setIsSubmitting(false);
      onAuthSuccess?.(user);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Failed to sign in.');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Glow Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-teal-400 to-pink-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 min-w-[40px] max-w-[40px] min-h-[40px] max-h-[40px] rounded-2xl bg-[#0A28BD] border border-blue-400/40 p-0.5 shadow-lg shadow-blue-950/60 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="Metfa Social"
                className="w-full h-full max-w-[40px] max-h-[40px] object-contain rounded-xl block pointer-events-none"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/metfa-emblem.png';
                }}
              />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>Join Metfa Social</span>
              </h3>
              <p className="text-xs text-gray-400">Single Account for AI Studio & Social Media</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar Picker / Upload */}
        <div className="flex items-center gap-3 p-3 bg-gray-950/80 rounded-2xl border border-gray-800/80 mb-4">
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
              <span className="text-xs font-bold text-gray-200">Profile Photo</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-bold text-purple-400 hover:text-purple-300 transition"
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
                    selectedAvatar === preset ? 'border-teal-400 ring-2 ring-teal-400/40' : 'border-gray-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs: Mobile Phone vs Gmail */}
        <div className="grid grid-cols-2 gap-2 bg-gray-950 p-1.5 rounded-2xl border border-gray-800 mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('phone');
              setErrorMsg('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              authMethod === 'phone'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile Phone</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMethod('gmail');
              setErrorMsg('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              authMethod === 'gmail'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Gmail / Email</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Elena Rostova or Alex Rivera"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1">
              Custom Username (Optional)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customUsername}
                onChange={(e) => setCustomUsername(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                placeholder="e.g. elena_ai or alex.creative"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>
          </div>

          {authMethod === 'phone' ? (
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">
                Mobile Phone Number
              </label>
              <div className="flex gap-2">
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
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
                  <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="1712 345678"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">
                Gmail or Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={gmailEmail}
                  onChange={(e) => setGmailEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 via-purple-500 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <span className="animate-pulse">Setting up Account...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Save Profile & Enter Metfa</span>
              </>
            )}
          </button>

          {/* Quick 1-click Google Sign-in demo button */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="bg-gray-900 px-2 text-gray-500 font-semibold">Or 1-Tap Access</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuickDemoGmail}
            className="w-full py-2 bg-gray-950 hover:bg-gray-850 border border-gray-800 text-gray-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <img
              src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
              alt="Google"
              className="w-4 h-4 object-contain"
            />
            <span>Instant Sign in with Google</span>
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-center gap-2 text-[11px] text-gray-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Encrypted storage & unified creator profile</span>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
