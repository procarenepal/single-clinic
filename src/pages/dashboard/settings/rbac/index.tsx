import React, { useState } from "react";
import { Card, CardBody, Tabs, Tab, Button } from "@heroui/react";
import { ShieldIcon, UsersIcon, ArrowLeftIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { title } from "@/components/primitives";

import { RoleManagement, UserManagement } from "../../../../components/rbac";
import { useAuth } from "../../../../hooks/useAuth";

export default function RBACManagementPage() {
  const { clinicId, isClinicAdmin } = useAuth();
  const [selectedTab, setSelectedTab] = useState("roles");
  const navigate = useNavigate();

  // Only clinic admins can access RBAC management
  if (!isClinicAdmin() || !clinicId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardBody className="text-center py-12">
            <ShieldIcon className="mx-auto mb-4 text-gray-400" size={48} />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">
              You need clinic administrator privileges to access role and user
              management.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className={`${title({ size: "lg" })} text-primary`}>Staff & User Management</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage roles, permissions, and user assignments for your clinic
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            className="text-gray-600 hover:text-gray-900"
            startContent={<ArrowLeftIcon size={16} />}
            variant="light"
            onPress={() => navigate("/dashboard/settings")}
          >
            Back to Settings
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border border-divider">
        <CardBody>
          <Tabs
            classNames={{
              tabList:
                "gap-6 w-full relative rounded-none p-0 border-b border-divider",
              cursor: "w-full bg-primary",
              tab: "max-w-fit px-0 h-12",
              tabContent: "group-data-[selected=true]:text-primary",
            }}
            selectedKey={selectedTab}
            variant="underlined"
            onSelectionChange={(key) => setSelectedTab(key as string)}
          >
            <Tab
              key="roles"
              title={
                <div className="flex items-center space-x-2">
                  <ShieldIcon size={16} />
                  <span>Role Management</span>
                </div>
              }
            >
              <div className="py-6">
                <RoleManagement clinicId={clinicId} />
              </div>
            </Tab>
            <Tab
              key="users"
              title={
                <div className="flex items-center space-x-2">
                  <UsersIcon size={16} />
                  <span>User Management</span>
                </div>
              }
            >
              <div className="py-6">
                <UserManagement clinicId={clinicId} />
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
