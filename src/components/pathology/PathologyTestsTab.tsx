import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoPrintOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { PathologyTest } from "@/types/models";

interface PathologyTestsTabProps {
  filteredTests: PathologyTest[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onPrint: (test: PathologyTest) => void;
  onEdit: (test: PathologyTest) => void;
  onDelete: (test: PathologyTest) => void;
  canEdit?: boolean;
}

export default function PathologyTestsTab({
  filteredTests,
  searchQuery,
  onSearchChange,
  onAdd,
  onPrint,
  onEdit,
  onDelete,
  canEdit = true,
}: PathologyTestsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-80">
          <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="w-full h-[32px] pl-9 pr-3 border border-border-base rounded text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            placeholder="Search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button
            color="primary"
            startContent={<IoAddOutline />}
            onClick={onAdd}
          >
            New Pathology Tests
          </Button>
        )}
      </div>

      {filteredTests.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border-base">
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Test Name
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Patient
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Test Type
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Category Name
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Lab Technician
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Charge Cat
                </th>
                {canEdit && (
                  <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTests.map((test) => (
                <tr
                  key={test.id}
                  className="hover:bg-surface-2/50 border-b border-border-base/50"
                >
                  <td className="px-4 py-2">
                    <p className="text-[13.5px] font-medium text-text-main">
                      {test.testName}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
                        {test.patientName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-[13.5px] font-medium text-text-main">
                          {test.patientName}
                        </p>
                        {test.patientEmail && (
                          <p className="text-[11.5px] text-text-muted">
                            {test.patientEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[13px] text-text-main">
                    {test.testType || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                      {test.categoryName}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {test.labTechnicianName ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold bg-health-500/10 text-health-600 border-health-500/20">
                        {test.labTechnicianName}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[13px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[13px] text-text-main">
                    {test.chargeCategory || "—"}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2">
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          color="secondary"
                          size="sm"
                          startContent={<IoPrintOutline />}
                          variant="flat"
                          onClick={() => onPrint(test)}
                        >
                          Print
                        </Button>
                        <Button
                          color="primary"
                          size="sm"
                          startContent={<IoCreateOutline />}
                          variant="flat"
                          onClick={() => onEdit(test)}
                        >
                          Edit
                        </Button>
                        <Button
                          color="danger"
                          size="sm"
                          startContent={<IoTrashOutline />}
                          variant="flat"
                          onClick={() => onDelete(test)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-text-muted text-[13.5px]">
            {searchQuery ? "No tests found" : "No pathology tests yet"}
          </p>
        </div>
      )}
    </div>
  );
}
