import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { PathologyTestType } from "@/types/models";

interface PathologyTestTypesTabProps {
  filteredTestTypes: PathologyTestType[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (testType: PathologyTestType) => void;
  onDelete: (testType: PathologyTestType) => void;
  canEdit?: boolean;
}

export default function PathologyTestTypesTab({
  filteredTestTypes,
  searchQuery,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  canEdit = true,
}: PathologyTestTypesTabProps) {
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
          <Button color="primary" startContent={<IoAddOutline />} onClick={onAdd}>
            New Test Price
          </Button>
        )}
      </div>

      {filteredTestTypes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border-base">
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Category / Parameter
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Price
                </th>
                {canEdit && (
                  <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTestTypes.map((testType) => (
                <tr
                  key={testType.id}
                  className="hover:bg-surface-2/50 border-b border-border-base/50"
                >
                  <td className="px-4 py-2">
                    <p className="text-[13.5px] font-medium text-text-main">
                      {testType.name}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    <p className="text-[13.5px] font-medium text-text-main">
                      NPR {testType.price.toFixed(2)}
                    </p>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button
                          color="primary"
                          size="sm"
                          startContent={<IoCreateOutline />}
                          variant="flat"
                          onClick={() => onEdit(testType)}
                        >
                          Edit
                        </Button>
                        <Button
                          color="danger"
                          size="sm"
                          startContent={<IoTrashOutline />}
                          variant="flat"
                          onClick={() => onDelete(testType)}
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
            {searchQuery ? "No prices found" : "No prices configured yet"}
          </p>
        </div>
      )}
    </div>
  );
}
