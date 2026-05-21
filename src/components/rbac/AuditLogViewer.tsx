import React, { useState, useEffect } from "react";
import { SearchIcon, ActivityIcon } from "lucide-react";
import { format } from "date-fns";

import {
  Card,
  CardBody,
  CardHeader,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  Chip,
  Input,
} from "@/components/ui";
import { auditLogService } from "@/services/auditLogService";
import { AuditLog } from "@/types/models";
import { addToast } from "@/components/ui/toast";

interface AuditLogViewerProps {
  clinicId: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ clinicId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadLogs();
  }, [clinicId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      // We could use pagination here, but for now we'll fetch the last 100 logs
      const fetchedLogs = await auditLogService.getClinicLogs(clinicId, 100);

      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Failed to load audit logs:", error);
      addToast({
        title: "Error",
        description: "Failed to load audit logs.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes("failed") || eventType.includes("deleted"))
      return "danger";
    if (
      eventType.includes("assigned") ||
      eventType.includes("created") ||
      eventType.includes("updated")
    )
      return "success";

    return "default";
  };

  const formatEventName = (eventType: string) => {
    return eventType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // Search by user, event, or details
    const searchableText = [
      log.performedByName,
      log.performedByEmail,
      log.eventType,
      log.details?.roleName,
      log.details?.userName,
      log.details?.userEmail,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  return (
    <Card className="shadow-none border border-divider h-[600px] flex flex-col">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <ActivityIcon className="text-purple-600" size={24} />
            Audit Logs
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Track user and role access changes within your clinic.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            className="w-full"
            placeholder="Search logs..."
            startContent={<SearchIcon className="text-gray-400" size={18} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>

      <CardBody className="p-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-full min-h-[300px]">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-auto h-full px-4 pb-4">
            <Table aria-label="Audit Logs Table" className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableColumn>TIMESTAMP</TableColumn>
                  <TableColumn>EVENT</TableColumn>
                  <TableColumn>PERFORMED BY</TableColumn>
                  <TableColumn>DETAILS</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                </TableRow>
              </TableHeader>
              <TableBody emptyContent="No audit logs found.">
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50/50">
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {format(new Date(log.timestamp), "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(log.timestamp), "h:mm a")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        className="font-medium"
                        color={getEventColor(log.eventType)}
                        size="sm"
                        variant="flat"
                      >
                        {formatEventName(log.eventType)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {log.performedByName || "System"}
                        </span>
                        {log.performedByEmail && (
                          <span className="text-xs text-gray-500">
                            {log.performedByEmail}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-sm">
                        {log.details?.roleName && (
                          <span className="block truncate">
                            <strong>Role:</strong> {log.details.roleName}
                          </span>
                        )}
                        {log.details?.userName && (
                          <span className="block truncate">
                            <strong>Target User:</strong> {log.details.userName}
                          </span>
                        )}
                        {log.details?.userEmail && (
                          <span className="block truncate text-xs text-gray-500">
                            ({log.details.userEmail})
                          </span>
                        )}
                        {log.errorMessage && (
                          <span className="block text-red-600 truncate mt-1 text-xs">
                            <strong>Error:</strong> {log.errorMessage}
                          </span>
                        )}
                        {!log.details?.roleName && !log.details?.userName && (
                          <span className="text-gray-400 italic">
                            No additional details
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={log.status === "success" ? "success" : "danger"}
                        size="sm"
                        variant="flat"
                      >
                        {log.status === "success" ? "Success" : "Failed"}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
