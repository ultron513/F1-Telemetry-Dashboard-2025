import DashboardLayout from "@/components/layout/DashboardLayout";

interface PageProps {
  title: string;
}

function PlaceholderPage({ title }: PageProps) {
  return (
    <DashboardLayout>
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="mt-4 text-muted-foreground">
            This page will be implemented in the upcoming steps.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
export default function Page() {
  return <PlaceholderPage title="Race Control" />;
}