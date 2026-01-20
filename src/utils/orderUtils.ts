export function generateOrderId(): string {
  // Generate a random number between 1000 and 9999
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  // Just return the 4-digit number as a string
  return randomNum.toString().padStart(4, '0'); // Ensures 4 digits even if number is less than 1000
}

// Helper function to check if an order ID already exists
// export async function isOrderIdUnique(
//   orderId: string,
//   prisma: PrismaClient
// ): Promise<boolean> {
//   const existingOrder = await prisma.order.findUnique({
//     where: { orderId },
//   });
//   return !existingOrder;
// } 