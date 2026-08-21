export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-patronaje min-h-screen bg-background">
      {children}
    </div>
  );
}
