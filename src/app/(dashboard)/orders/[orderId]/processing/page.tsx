import ProcessingClient from "./_processing-client";

export default async function ProcessingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <ProcessingClient orderId={orderId} />;
}
