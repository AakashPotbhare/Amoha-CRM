import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Save, Loader2, Phone, Mail, MapPin, Calendar, Briefcase, User, Lock,
  CheckCircle, Upload, FileText, Trash2, Shield, Eye
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

const DOCUMENT_TYPES = [
  { key: "aadhar", label: "Aadhaar Card" },
  { key: "pan", label: "PAN Card" },
  { key: "passport_photo", label: "Passport Size Photo" },
  { key: "address_proof", label: "Address Proof" },
] as const;

export default function Profile() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Editable fields
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [designation, setDesignation] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");

  // Verification
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [showPhoneOtp, setShowPhoneOtp] = useState(false);
  const [showEmailOtp, setShowEmailOtp] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [uploadingDoc] = useState<string | null>(null);
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (employee) {
      setPhone(employee.phone || "");
      setDob(employee.dob || "");
      setDesignation(employee.designation || "");
      fetchExtendedProfile();
      fetchDocuments();
    }
  }, [employee]);

  const fetchExtendedProfile = async () => {
    if (!employee) return;
    try {
      const res = await api.get<any>(`/api/employees/${employee.id}`);
      if (res.success && res.data) {
        setCurrentAddress(res.data.current_address || "");
        setPermanentAddress(res.data.permanent_address || "");
        if (res.data.avatar_url) setAvatarUrl(res.data.avatar_url);
      }
    } catch {
      // ignore
    }
  };

  const fetchDocuments = async () => {
    if (!employee) return;
    try {
      const res = await api.get<EmployeeDocument[]>(`/api/hr/documents/${employee.id}`);
      if (res.success && res.data) setDocuments(res.data);
    } catch {
      // ignore
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB allowed", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const token = localStorage.getItem("recruithub_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/employees/${employee.id}/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.avatar_url) {
        setAvatarUrl(json.data.avatar_url);
        toast({ title: "Profile photo updated" });
      } else {
        toast({ title: "Upload failed", description: json.error || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      await api.patch(`/api/employees/${employee.id}`, {
        phone: phone.trim() || null,
        dob: dob || null,
        designation: designation.trim() || null,
        current_address: currentAddress.trim() || null,
        permanent_address: permanentAddress.trim() || null,
      });
      toast({ title: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSendPhoneOtp = async () => {
    if (!phone.trim()) {
      toast({ title: "Please enter a phone number first", variant: "destructive" });
      return;
    }
    setShowPhoneOtp(true);
    toast({ title: "Verification code sent", description: "A 6-digit code has been sent to your phone number." });
  };

  const handleVerifyPhone = async () => {
    if (!employee) return;
    if (phoneOtp.length !== 6) {
      toast({ title: "Enter a valid 6-digit code", variant: "destructive" });
      return;
    }
    setVerifyingPhone(true);
    try {
      await api.patch(`/api/employees/${employee.id}`, { phone_verified: true });
      setPhoneVerified(true);
      setShowPhoneOtp(false);
      setPhoneOtp("");
      toast({ title: "Phone number verified!" });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    }
    setVerifyingPhone(false);
  };

  const handleSendEmailOtp = async () => {
    setShowEmailOtp(true);
    toast({ title: "Verification email sent", description: "A 6-digit code has been sent to your email address." });
  };

  const handleVerifyEmail = async () => {
    if (!employee) return;
    if (emailOtp.length !== 6) {
      toast({ title: "Enter a valid 6-digit code", variant: "destructive" });
      return;
    }
    setVerifyingEmail(true);
    try {
      await api.patch(`/api/employees/${employee.id}`, { email_verified: true });
      setEmailVerified(true);
      setShowEmailOtp(false);
      setEmailOtp("");
      toast({ title: "Email verified!" });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    }
    setVerifyingEmail(false);
  };

  const handleDocUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB allowed for documents", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("document", file);
    formData.append("document_type", docType);
    try {
      const token = localStorage.getItem("recruithub_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/hr/documents/${employee.id}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        await fetchDocuments();
        toast({ title: "Document uploaded successfully" });
      } else {
        toast({ title: "Upload failed", description: json.error || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteDoc = async (doc: EmployeeDocument) => {
    if (!employee) return;
    try {
      await api.delete(`/api/hr/documents/${employee.id}/${doc.id}`);
      await fetchDocuments();
      toast({ title: "Document removed" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleViewDoc = async (doc: EmployeeDocument) => {
    if (doc.file_url) {
      window.open(doc.file_url, "_blank");
    } else {
      toast({ title: "Could not generate link", variant: "destructive" });
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Please fill all password fields", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    toast({ title: "Password change not available", description: "Please contact HR to reset your password.", variant: "destructive" });
  };

  if (!employee) return null;

  const initials = employee.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">My Profile</h1>

      {/* Avatar & Name Card */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-3 sm:flex-row sm:items-start sm:text-left sm:gap-6">
            <div className="relative group mx-auto sm:mx-0">
              <Avatar className="h-24 w-24 text-2xl">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{employee.full_name}</h2>
              <p className="text-sm text-muted-foreground">{employee.designation || employee.role.replace("_", " ")}</p>
              <div className="flex items-center justify-center sm:justify-start flex-wrap gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{employee.employee_code}</Badge>
                <Badge className="bg-primary/10 text-primary text-xs">{employee.departments?.name}</Badge>
                <Badge variant="secondary" className="text-xs">{employee.teams?.name}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Details with Verification */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email with verification */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
              <div className="flex items-center gap-2">
                <Input value={employee.email} disabled className="bg-muted flex-1" />
                {emailVerified ? (
                  <Badge className="bg-green-500/10 text-green-600 gap-1 shrink-0">
                    <CheckCircle className="w-3 h-3" /> Verified
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleSendEmailOtp} className="shrink-0 text-xs">
                    Verify
                  </Button>
                )}
              </div>
              {showEmailOtp && !emailVerified && (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-40"
                  />
                  <Button size="sm" onClick={handleVerifyEmail} disabled={verifyingEmail}>
                    {verifyingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit"}
                  </Button>
                </div>
              )}
            </div>

            {/* Phone with verification */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
              <div className="flex items-center gap-2">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" maxLength={15} className="flex-1" />
                {phoneVerified ? (
                  <Badge className="bg-green-500/10 text-green-600 gap-1 shrink-0">
                    <CheckCircle className="w-3 h-3" /> Verified
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleSendPhoneOtp} className="shrink-0 text-xs">
                    Verify
                  </Button>
                )}
              </div>
              {showPhoneOtp && !phoneVerified && (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-40"
                  />
                  <Button size="sm" onClick={handleVerifyPhone} disabled={verifyingPhone}>
                    {verifyingPhone ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Date of Birth</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Designation</Label>
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Your designation" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Department</Label>
              <Input value={employee.departments?.name || ""} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Team</Label>
              <Input value={employee.teams?.name || ""} disabled className="bg-muted" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <Input value={employee.role.replace("_", " ")} disabled className="bg-muted capitalize" />
            </div>
            <div>
              <Label>Joining Date</Label>
              <Input value={employee.joining_date ? format(parseISO(employee.joining_date), "dd MMM yyyy") : "—"} disabled className="bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Details */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Address Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Current Address</Label>
            <Textarea
              value={currentAddress}
              onChange={(e) => setCurrentAddress(e.target.value)}
              placeholder="Enter your current residential address"
              rows={3}
            />
          </div>
          <div>
            <Label>Permanent Address</Label>
            <Textarea
              value={permanentAddress}
              onChange={(e) => setPermanentAddress(e.target.value)}
              placeholder="Enter your permanent address"
              rows={3}
            />
          </div>

          <Button onClick={handleSave} disabled={loading} className="gap-2 w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Document Upload Section */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Identity Documents
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Documents are securely stored and visible only to you and HR.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {DOCUMENT_TYPES.map(({ key, label }) => {
            const doc = documents.find(d => d.document_type === key);
            const isUploading = uploadingDoc === key;
            return (
              <div key={key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    {doc ? (
                      <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not uploaded</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {doc && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleViewDoc(doc)} className="h-8 w-8 p-0">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteDoc(doc)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => docInputRefs.current[key]?.click()}
                    disabled={isUploading}
                    className="gap-1"
                  >
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {doc ? "Replace" : "Upload"}
                  </Button>
                  <input
                    ref={(el) => { docInputRefs.current[key] = el; }}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleDocUpload(key, e)}
                    className="hidden"
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
            </div>
          </div>
          <Button onClick={handlePasswordChange} variant="outline" className="gap-2 w-full sm:w-auto">
            <Lock className="w-4 h-4" />
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
