import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import {
  PathologyParameter,
  PathologyUnit,
  PathologyCategory,
} from "@/types/models";

interface PathologyParametersTabProps {
  filteredParameters: PathologyParameter[];
  categories: PathologyCategory[];
  units: PathologyUnit[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (parameter: PathologyParameter) => void;
  onDelete: (parameter: PathologyParameter) => void;
  canEdit?: boolean;
}

export default function PathologyParametersTab({
  filteredParameters,
  categories,
  units,
  searchQuery,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  canEdit = true,
}: PathologyParametersTabProps) {
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
            New Pathology Parameters
          </Button>
        )}
      </div>

      {filteredParameters.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border-base">
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Name
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Category
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Type
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Reference Range
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Unit
                </th>
                {canEdit && (
                  <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredParameters.map((parameter) => {
                const unitObj = units.find((u) => u.id === parameter.unit);

                return (
                  <tr
                    key={parameter.id}
                    className="hover:bg-surface-2/50 border-b border-border-base/50"
                  >
                    <td className="px-4 py-2">
                      <p className="text-[13.5px] font-medium text-text-main">
                        {parameter.name}
                      </p>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold bg-surface-2 text-text-main border-border-base">
                        {categories.find((c) => c.id === parameter.categoryId)
                          ?.name || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          parameter.resultType === "numeric"
                            ? "bg-blue-500/10 text-blue-500"
                            : parameter.resultType === "select"
                              ? "bg-purple-500/10 text-purple-500"
                              : parameter.resultType === "boolean"
                                ? "bg-orange-500/10 text-orange-500"
                                : "bg-gray-500/10 text-gray-500"
                        }`}
                      >
                        {parameter.resultType || "text"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[13px] text-text-main">
                      {parameter.referenceRange || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                        {unitObj?.name || parameter.unit}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button
                            color="primary"
                            size="sm"
                            startContent={<IoCreateOutline />}
                            variant="flat"
                            onClick={() => onEdit(parameter)}
                          >
                            Edit
                          </Button>
                          <Button
                            color="danger"
                            size="sm"
                            startContent={<IoTrashOutline />}
                            variant="flat"
                            onClick={() => onDelete(parameter)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-text-muted text-[13.5px]">
            {searchQuery
              ? "No parameters found"
              : "No pathology parameters yet"}
          </p>
        </div>
      )}
    </div>
  );
}
