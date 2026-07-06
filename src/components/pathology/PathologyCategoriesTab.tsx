import React, { useState } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoChevronDownOutline,
  IoChevronForwardOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import {
  PathologyCategory,
  PathologyParameter,
  PathologyUnit,
} from "@/types/models";

interface PathologyCategoriesTabProps {
  filteredCategories: PathologyCategory[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (category: PathologyCategory) => void;
  onDelete: (category: PathologyCategory) => void;
  onAddSubCategory: (category: PathologyCategory) => void;
  onEditParameter: (parameter: PathologyParameter) => void;
  onDeleteParameter: (parameter: PathologyParameter) => void;
  parameters: PathologyParameter[];
  units: PathologyUnit[];
  canEdit?: boolean;
}

export default function PathologyCategoriesTab({
  filteredCategories,
  searchQuery,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  onAddSubCategory,
  onEditParameter,
  onDeleteParameter,
  parameters,
  units,
  canEdit = true,
}: PathologyCategoriesTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);

      next.has(id) ? next.delete(id) : next.add(id);

      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div className="relative w-80">
          <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="w-full h-[32px] pl-9 pr-3 border border-border-base rounded text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            placeholder="Search categories…"
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
            New Pathology Category
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredCategories.length > 0 ? (
        <div className="border border-border-base rounded overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border-base">
                <th className="w-8 px-3 py-2" />
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Category
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                  Parameters
                </th>
                {canEdit && (
                  <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em] text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => {
                const catParams = parameters.filter(
                  (p) => p.categoryId === category.id,
                );
                const isOpen = expandedIds.has(category.id);

                return (
                  <React.Fragment key={category.id}>
                    {/* ── Category row ── */}
                    <tr
                      key={category.id}
                      className="border-b border-border-base/50 hover:bg-surface-2/40 cursor-pointer select-none"
                      onClick={() => toggle(category.id)}
                    >
                      <td className="px-3 py-3 text-text-muted w-8">
                        {isOpen ? (
                          <IoChevronDownOutline className="w-3.5 h-3.5" />
                        ) : (
                          <IoChevronForwardOutline className="w-3.5 h-3.5" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13.5px] font-bold text-text-main">
                          {category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {catParams.length === 0 ? (
                          <span className="text-[12px] italic text-warning">
                            No parameters
                          </span>
                        ) : (
                          <span className="text-[12px] text-text-muted">
                            {catParams.length} parameter
                            {catParams.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              color="default"
                              size="sm"
                              startContent={<IoAddOutline />}
                              variant="flat"
                              onClick={() => onAddSubCategory(category)}
                            >
                              Add Parameter
                            </Button>
                            <Button
                              isIconOnly
                              color="primary"
                              size="sm"
                              variant="flat"
                              onClick={() => onEdit(category)}
                            >
                              <IoCreateOutline />
                            </Button>
                            <Button
                              isIconOnly
                              color="danger"
                              size="sm"
                              variant="flat"
                              onClick={() => onDelete(category)}
                            >
                              <IoTrashOutline />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* ── Collapsible parameter table ── */}
                    {isOpen && (
                      <tr key={`${category.id}-params`}>
                        <td
                          className="p-0 bg-surface-2/20 border-b border-border-base/40"
                          colSpan={4}
                        >
                          {catParams.length === 0 ? (
                            <p className="px-10 py-3 text-[12px] text-text-muted italic">
                              No parameters configured. Click "Add Parameter" to
                              add one.
                            </p>
                          ) : (
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-surface-2/80 border-b border-border-base/30">
                                  <th className="pl-10 pr-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-left">
                                    Parameter
                                  </th>
                                  <th className="px-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-left">
                                    Type
                                  </th>
                                  <th className="px-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-left">
                                    Reference Range
                                  </th>
                                  <th className="px-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-left">
                                    Unit
                                  </th>
                                  <th className="px-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-left">
                                    Min
                                  </th>
                                  <th className="px-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-left">
                                    Max
                                  </th>
                                  <th className="px-4 py-1.5 text-[10px] font-bold text-warning uppercase tracking-wider text-left">
                                    Critical Low
                                  </th>
                                  <th className="px-4 py-1.5 text-[10px] font-bold text-danger uppercase tracking-wider text-left">
                                    Critical High
                                  </th>
                                  {canEdit && (
                                    <th className="px-4 py-1.5 w-16" />
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {catParams.map((p, i) => {
                                  const unitName =
                                    units.find((u) => u.id === p.unit)?.name ||
                                    "—";

                                  return (
                                    <tr
                                      key={p.id}
                                      className={`border-b border-border-base/20 ${i % 2 !== 0 ? "bg-surface-2/20" : ""}`}
                                    >
                                      <td className="pl-10 pr-4 py-2 text-[12.5px] font-semibold text-text-main">
                                        {p.name}
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                                          {p.resultType === "boolean"
                                            ? "POS/NEG"
                                            : p.resultType === "numeric"
                                              ? "NUMERIC"
                                              : p.resultType === "select"
                                                ? "DROPDOWN"
                                                : p.resultType?.toUpperCase() ||
                                                  "NUMERIC"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-[12px] text-text-main font-medium">
                                        {p.referenceRange || "—"}
                                      </td>
                                      <td className="px-4 py-2 text-[12px] text-primary font-bold">
                                        {unitName}
                                      </td>
                                      <td className="px-4 py-2 text-[12px] text-text-muted">
                                        {p.minValue ?? "—"}
                                      </td>
                                      <td className="px-4 py-2 text-[12px] text-text-muted">
                                        {p.maxValue ?? "—"}
                                      </td>
                                      <td className="px-4 py-2 text-[12px] text-warning font-medium">
                                        {p.criticalLow ?? "—"}
                                      </td>
                                      <td className="px-4 py-2 text-[12px] text-danger font-medium">
                                        {p.criticalHigh ?? "—"}
                                      </td>
                                      {canEdit && (
                                        <td
                                          className="px-2 py-1.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="flex gap-1 justify-end">
                                            <Button
                                              isIconOnly
                                              color="primary"
                                              size="sm"
                                              variant="flat"
                                              onClick={() => onEditParameter(p)}
                                            >
                                              <IoCreateOutline className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                              isIconOnly
                                              color="danger"
                                              size="sm"
                                              variant="flat"
                                              onClick={() =>
                                                onDeleteParameter(p)
                                              }
                                            >
                                              <IoTrashOutline className="w-3.5 h-3.5" />
                                            </Button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-text-muted text-[13.5px]">
            {searchQuery
              ? "No categories found"
              : "No pathology categories yet"}
          </p>
        </div>
      )}
    </div>
  );
}
