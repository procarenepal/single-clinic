import { pathologyService } from "../services/pathologyService";

/**
 * Utility to seed standard pathology data (e.g. CBC)
 */
export const pathologySeeder = {
  async seedCBC(clinicId: string, branchId: string, userId: string) {
    try {
      console.log("Starting CBC seeding...");

      // 1. Create Units if they don't exist
      const existingUnits = await pathologyService.getUnitsByClinic(
        clinicId,
        branchId,
      );
      const unitMap: Record<string, string> = {};

      const unitsToCreate = [
        { name: "g/dL" },
        { name: "million/cmm" },
        { name: "/cmm" },
        { name: "%" },
        { name: "fL" },
        { name: "pg" },
      ];

      for (const unit of unitsToCreate) {
        const found = existingUnits.find((u) => u.name === unit.name);

        if (found) {
          unitMap[unit.name] = found.id;
        } else {
          const id = await pathologyService.createUnit({
            name: unit.name,
            clinicId,
            branchId,
            isActive: true,
            createdBy: userId,
          });

          unitMap[unit.name] = id;
        }
      }

      // 2. Create CBC Category
      const cbcCategoryId = await pathologyService.createCategory({
        name: "Complete Blood Count (CBC)",
        clinicId,
        branchId,
        isActive: true,
        createdBy: userId,
      });

      // 3. Create Parameters
      const parameters = [
        {
          name: "Hemoglobin (Hb)",
          referenceRange: "12.0 - 17.5",
          referenceRangeMale: "13.5 - 17.5",
          referenceRangeFemale: "12.0 - 15.5",
          unit: unitMap["g/dL"],
          resultType: "numeric" as const,
          minValue: 12.0,
          maxValue: 17.5,
          minValueMale: 13.5,
          maxValueMale: 17.5,
          minValueFemale: 12.0,
          maxValueFemale: 15.5,
          criticalLow: 7.0,
          criticalHigh: 20.0,
        },
        {
          name: "Total Leucocyte Count (TLC/WBC)",
          referenceRange: "4000 - 11000",
          unit: unitMap["/cmm"],
          resultType: "numeric" as const,
          minValue: 4000,
          maxValue: 11000,
          criticalLow: 2000,
          criticalHigh: 30000,
        },
        {
          name: "Red Blood Cell (RBC) Count",
          referenceRange: "3.8 - 5.5",
          referenceRangeMale: "4.5 - 5.5",
          referenceRangeFemale: "3.8 - 4.8",
          unit: unitMap["million/cmm"],
          resultType: "numeric" as const,
          minValue: 3.8,
          maxValue: 5.5,
          minValueMale: 4.5,
          maxValueMale: 5.5,
          minValueFemale: 3.8,
          maxValueFemale: 4.8,
        },
        {
          name: "Platelet Count",
          referenceRange: "150000 - 450000",
          unit: unitMap["/cmm"],
          resultType: "numeric" as const,
          minValue: 150000,
          maxValue: 450000,
          criticalLow: 50000,
          criticalHigh: 1000000,
        },
        {
          name: "Packed Cell Volume (PCV/Hematocrit)",
          referenceRange: "36 - 50",
          referenceRangeMale: "40 - 50",
          referenceRangeFemale: "36 - 46",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 36,
          maxValue: 50,
          minValueMale: 40,
          maxValueMale: 50,
          minValueFemale: 36,
          maxValueFemale: 46,
        },
        {
          name: "MCV",
          referenceRange: "80 - 100",
          unit: unitMap["fL"],
          resultType: "numeric" as const,
          minValue: 80,
          maxValue: 100,
        },
        {
          name: "MCH",
          referenceRange: "27 - 32",
          unit: unitMap["pg"],
          resultType: "numeric" as const,
          minValue: 27,
          maxValue: 32,
        },
        {
          name: "MCHC",
          referenceRange: "32 - 36",
          unit: unitMap["g/dL"],
          resultType: "numeric" as const,
          minValue: 32,
          maxValue: 36,
        },
        {
          name: "Neutrophils",
          referenceRange: "40 - 75",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 40,
          maxValue: 75,
        },
        {
          name: "Lymphocytes",
          referenceRange: "20 - 45",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 20,
          maxValue: 45,
        },
        {
          name: "Monocytes",
          referenceRange: "2 - 10",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 2,
          maxValue: 10,
        },
        {
          name: "Eosinophils",
          referenceRange: "1 - 6",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 1,
          maxValue: 6,
        },
        {
          name: "Basophils",
          referenceRange: "0 - 1",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 0,
          maxValue: 1,
        },
      ];

      for (const param of parameters) {
        await pathologyService.createParameter({
          ...param,
          categoryId: cbcCategoryId,
          clinicId,
          branchId,
          isActive: true,
          createdBy: userId,
        });
      }

      // 4. Create a default Test Type (Price) for CBC
      await pathologyService.createTestType({
        name: "Complete Blood Count (CBC)",
        price: 500, // Default price
        targetType: "category",
        targetId: cbcCategoryId,
        clinicId,
        branchId,
        isActive: true,
        createdBy: userId,
      });

      console.log("CBC seeding completed successfully!");

      return true;
    } catch (error) {
      console.error("Error seeding CBC data:", error);
      throw error;
    }
  },
};
