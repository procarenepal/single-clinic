import React, { useState, useRef } from "react";
import {
  IoCameraOutline,
  IoPersonOutline,
  IoCallOutline,
} from "react-icons/io5";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/context/AuthContext";
import { uploadFileToFirebase } from "@/services/firebaseStorageService";
import { addToast } from "@/components/ui/toast";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { userData, currentUser, updateProfileInfo } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [displayName, setDisplayName] = useState(
    userData?.displayName || currentUser?.displayName || "",
  );
  const [phone, setPhone] = useState(userData?.phone || "");
  const [photoURL, setPhotoURL] = useState(
    userData?.photoURL || currentUser?.photoURL || "",
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadFileToFirebase(
        file,
        `avatars/${currentUser?.uid || "guest"}`
      );

      setPhotoURL(result.url);
      addToast({
        title: "Success",
        description: "Profile picture uploaded successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Image upload failed:", error);
      addToast({
        title: "Upload Failed",
        description: "Could not upload profile picture. Please try again.",
        color: "danger",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfileInfo({
        displayName,
        phone,
        photoURL,
      });

      addToast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
        color: "success",
      });
      onClose();
    } catch (error) {
      console.error("Profile update failed:", error);
      addToast({
        title: "Update Failed",
        description: "An error occurred while updating your profile.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} size="md" onClose={onClose}>
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>Edit Profile</ModalHeader>
          <ModalBody className="space-y-6 py-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4 mb-2">
              <div className="relative group">
                <Avatar
                  className="w-24 h-24 text-2xl border-2 border-mountain-100 dark:border-zinc-800"
                  color="primary"
                  name={displayName}
                  src={photoURL}
                />
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                  disabled={uploading}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IoCameraOutline className="w-8 h-8 text-white" />
                </button>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-mountain-400 font-medium uppercase tracking-wider">
                Click to change photo
              </p>
              <input
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                type="file"
                onChange={handleImageUpload}
              />
            </div>

            <div className="space-y-4">
              <Input
                fullWidth
                isRequired
                label="Full Name"
                placeholder="Enter your full name"
                startContent={<IoPersonOutline className="text-mountain-400" />}
                value={displayName}
                onValueChange={setDisplayName}
              />

              <Input
                fullWidth
                label="Contact Number"
                placeholder="Enter your phone number"
                startContent={<IoCallOutline className="text-mountain-400" />}
                value={phone}
                onValueChange={setPhone}
              />

              <div className="p-3 bg-mountain-50 dark:bg-zinc-900/50 border border-mountain-100 dark:border-zinc-800 rounded-lg">
                <p className="text-[11px] text-mountain-500 font-semibold uppercase tracking-widest mb-1">
                  Email Address
                </p>
                <p className="text-xs text-mountain-900 dark:text-zinc-200">
                  {currentUser?.email}
                </p>
                <p className="text-[10px] text-mountain-400 mt-1 italic">
                  Email address cannot be changed from this profile editor.
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              isDisabled={loading}
              size="sm"
              variant="light"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={uploading}
              isLoading={loading}
              size="sm"
              type="submit"
            >
              Save Changes
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
