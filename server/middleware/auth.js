import { clerkClient } from "@clerk/express";

export const auth = async (req, res, next) => {
  try {
    const authData = await req.auth();
    const userId = authData?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No userId",
      });
    }

    const user = await clerkClient.users.getUser(userId);

    // Check plan from metadata (recommended way)
    const hasPremiumPlan =
      user.publicMetadata?.plan === "premium" ||
      user.privateMetadata?.plan === "premium";

    // Handle free usage counter
    if (!hasPremiumPlan && user.privateMetadata?.free_usage) {
      req.free_usage = user.privateMetadata.free_usage;
    } else {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: 0,
        },
      });

      req.free_usage = 0;
    }

    req.plan = hasPremiumPlan ? "premium" : "free";
    req.userId = userId;

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
