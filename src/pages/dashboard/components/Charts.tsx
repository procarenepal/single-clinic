import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

// Register Chart.js components including Filler for area gradients
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler,
);

export interface LineChartProps {
  data: any;
  options?: any;
}

export interface DoughnutChartProps {
  data: any;
  options?: any;
}

/**
 * Creates a vertical linear gradient for the line chart area fill.
 * Falls back to a semi-transparent color if canvas context is unavailable.
 */
function createGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number },
  color: string,
) {
  const gradient = ctx.createLinearGradient(
    0,
    chartArea.top,
    0,
    chartArea.bottom,
  );

  // Derive the transparent version; color is expected to be an HSL/HEX/RGB string
  gradient.addColorStop(
    0,
    color.replace(")", ", 0.25)").replace("rgb", "rgba").replace("hsl", "hsla"),
  );
  gradient.addColorStop(
    0.7,
    color.replace(")", ", 0.05)").replace("rgb", "rgba").replace("hsl", "hsla"),
  );
  gradient.addColorStop(
    1,
    color.replace(")", ", 0)").replace("rgb", "rgba").replace("hsl", "hsla"),
  );

  return gradient;
}

export function PatientVisitsChart({ data, options }: LineChartProps) {
  const memoData = useMemo(() => {
    if (!data) return data;

    return {
      ...data,
      datasets: data.datasets?.map((dataset: any) => ({
        ...dataset,
        fill: true,
        // backgroundColor will be set by the gradient plugin below; we use a string placeholder
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;

          if (!chartArea) return "transparent";
          const color = dataset.borderColor ?? "#0356a1";

          return createGradient(ctx, chartArea, color);
        },
        borderWidth: 2.5,
        tension: 0.45,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: (context: any) =>
          context.dataset.borderColor ?? "#0356a1",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverBackgroundColor: (context: any) =>
          context.dataset.borderColor ?? "#0356a1",
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
      })),
    };
  }, [data]);

  const premiumOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      animation: {
        duration: 1800,
        easing: "easeInOutQuart" as const,
      },
      scales: {
        x: {
          grid: {
            color: "rgba(127, 140, 141, 0.08)",
            drawBorder: false,
          },
          ticks: {
            color: "rgba(127, 140, 141, 0.75)",
            font: { size: 11 },
          },
          border: { display: false },
          ...(options?.scales?.x ?? {}),
        },
        y: {
          grid: {
            color: "rgba(127, 140, 141, 0.08)",
            drawBorder: false,
          },
          ticks: {
            color: "rgba(127, 140, 141, 0.75)",
            font: { size: 11 },
            maxTicksLimit: 6,
          },
          border: { display: false },
          ...(options?.scales?.y ?? {}),
        },
        ...(options?.scales ?? {}),
      },
      plugins: {
        ...(options?.plugins ?? {}),
        legend: {
          display: false,
          ...(options?.plugins?.legend ?? {}),
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          backdropBlur: 8,
          titleColor: "#f8fafc",
          bodyColor: "#cbd5e1",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          padding: { x: 14, y: 10 },
          cornerRadius: 10,
          displayColors: true,
          boxWidth: 10,
          boxHeight: 10,
          boxPadding: 4,
          titleFont: { size: 13, weight: "600" as const },
          bodyFont: { size: 12 },
          usePointStyle: true,
          ...(options?.plugins?.tooltip ?? {}),
        },
      },
    }),
    [options],
  );

  return <Line data={memoData} options={premiumOptions} />;
}

export function AppointmentStatusChart({ data, options }: DoughnutChartProps) {
  const memoData = useMemo(() => data, [data]);

  const premiumOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 1400,
        animateRotate: true,
        animateScale: true,
        easing: "easeOutQuart" as const,
      },
      cutout: "72%",
      plugins: {
        ...(options?.plugins ?? {}),
        legend: {
          position: "bottom" as const,
          labels: {
            usePointStyle: true,
            pointStyle: "circle" as const,
            padding: 20,
            color: "rgba(127, 140, 141, 0.85)",
            font: { size: 12 },
          },
          ...(options?.plugins?.legend ?? {}),
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          titleColor: "#f8fafc",
          bodyColor: "#cbd5e1",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          padding: { x: 14, y: 10 },
          cornerRadius: 10,
          displayColors: true,
          boxWidth: 10,
          boxHeight: 10,
          boxPadding: 4,
          titleFont: { size: 13, weight: "600" as const },
          bodyFont: { size: 12 },
          usePointStyle: true,
          ...(options?.plugins?.tooltip ?? {}),
        },
      },
    }),
    [options],
  );

  return <Doughnut data={memoData} options={premiumOptions} />;
}
