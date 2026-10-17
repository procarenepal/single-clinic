import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { addToast } from "@heroui/toast";

import { title } from "@/components/primitives";
import { invitationService } from "@/services/invitationService";
import { clinicService } from "@/services/clinicService";
import { auth, db } from "@/config/firebase";
import { Invitation, UserRole } from "@/types/models";
import DefaultLayout from "@/layouts/default";

export default function InvitationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch invitation details on component mount
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const invitationData = await invitationService.getInvitationById(id);

        if (!invitationData) {
          setError("Invitation not found");

          return;
        }

        if (invitationData.status === "expired") {
          setError("This invitation has expired");

          return;
        }

        if (invitationData.status === "accepted") {
          setError("This invitation has already been accepted");

          return;
        }

        // Check if invitation is expired by date
        const now = new Date();
        const expiryDate = invitationData.expiresAt;

        if (now > expiryDate) {
          await invitationService.cancelInvitation(id);
          setError("This invitation has expired");

          return;
        }

        setInvitation(invitationData);

        // The clinic's name is a nicety on this page. The visitor has no
        // account yet, and clinic documents are readable only when signed
        // in, so a failure here must not block the invitation itself.
        try {
          const clinicData = await clinicService.getClinicById(
            invitationData.clinicId,
          );

          if (clinicData) {
            setClinic(clinicData);
          }
        } catch (clinicError) {
          console.warn("Clinic details unavailable before sign-up:", clinicError);
        }
      } catch (error) {
        console.error("Error fetching invitation:", error);
        setError("Failed to load invitation details");
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [id]);

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Name is required";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) return;

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Create new user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        invitation.email,
        password,
      );

      // Create the user document. It carries the invitation id because the
      // security rules only let a person create their own record when it
      // matches a pending invitation's role and clinic. (The previous
      // updateUser() call failed outright here: there was no document to
      // update yet.)
      await setDoc(doc(db, "users", userCredential.user.uid), {
        id: userCredential.user.uid,
        displayName: name,
        email: invitation.email,
        clinicId: invitation.clinicId,
        role: invitation.role as UserRole,
        isActive: true,
        invitationId: invitation.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Mark invitation as accepted
      await invitationService.acceptInvitation(invitation.id);

      // Send email verification
      await sendEmailVerification(userCredential.user);

      addToast({
        title: "Success",
        description:
          "Your account has been created successfully. You can now log in.",
        color: "success",
      });

      navigate("/login");
    } catch (error) {
      console.error("Error creating account:", error);
      addToast({
        title: "Error",
        description: "Failed to create your account. Please try again.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <DefaultLayout>
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      </DefaultLayout>
    );
  }

  // Error state
  if (error || !invitation) {
    return (
      <DefaultLayout>
        <div className="max-w-xl mx-auto mt-12">
          <Card className="shadow-md">
            <CardHeader>
              <h1 className={title({ size: "sm" })}>Invitation Error</h1>
            </CardHeader>
            <CardBody>
              <div className="text-center py-8">
                <div className="text-danger mb-6">
                  <svg
                    className="mx-auto"
                    fill="none"
                    height="64"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="64"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                </div>
                <p className="text-xl font-medium mb-4">
                  {error || "Invalid Invitation"}
                </p>
                <p className="text-default-600 mb-6">
                  Please contact your clinic administrator for a new invitation.
                </p>
                <Button color="primary" onClick={() => navigate("/login")}>
                  Go to Login
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="max-w-2xl mx-auto mt-12">
        <Card className="shadow-md">
          <CardHeader>
            <h1 className={title({ size: "sm" })}>
              Join {clinic?.name || "the clinic"}
            </h1>
            <p className="text-default-600 mt-2">
              You've been invited to join as a{" "}
              {invitation.role.replace("-", " ")}
            </p>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium">Your Information</h2>
                  <p className="text-default-500 text-sm mb-4">
                    Complete your profile to join the clinic
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm">
                    <strong>Email:</strong> {invitation.email}
                  </p>
                  <p className="text-sm mt-1">
                    <strong>Role:</strong> {invitation.role.replace("-", " ")}
                  </p>
                </div>

                <Input
                  isRequired
                  errorMessage={formErrors.name}
                  isInvalid={!!formErrors.name}
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                <Input
                  isRequired
                  errorMessage={formErrors.password}
                  isInvalid={!!formErrors.password}
                  label="Password"
                  placeholder="Create a secure password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <Input
                  isRequired
                  errorMessage={formErrors.confirmPassword}
                  isInvalid={!!formErrors.confirmPassword}
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <p className="text-xs text-default-500">
                  By creating an account, you agree to the clinic's terms and
                  conditions and privacy policy.
                </p>
              </div>

              <div className="flex justify-end mt-8">
                <Button color="primary" isLoading={submitting} type="submit">
                  Create Account & Join Clinic
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </DefaultLayout>
  );
}
