// src/modules/payment/payment.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { PaymentService } from "./payment.service";
import stripe from "stripe";
import catchAsync from "../../shared/catchAsync";
import { config } from "../../../config";

const getAvailablePlans = catchAsync(async (req: Request, res: Response) => {
  const plans = await PaymentService.getAvailablePlans();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plans retrieved successfully",
    data: plans
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;
  const plan = await PaymentService.getPlanById(planId);
  
  if (!plan) {
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: "Plan not found",
      data: null
    });
  }
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan retrieved successfully",
    data: plan
  });
});

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {

  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.createCheckoutSession(userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Checkout session created successfully",
    data: result
  });

});

const createDirectPayment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.createDirectPayment(userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment initiated successfully",
    data: result
  });
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  
  if (!sig) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "No stripe signature found",
      data: null
    });
  }

  let event: stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.STRIPE.WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: `Webhook Error: ${err.message}`,
      data: null
    });
  }

  // Handle the event
  await PaymentService.handleWebhook(event);

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

const getPaymentMethods = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const paymentMethods = await PaymentService.getPaymentMethods(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment methods retrieved successfully",
    data: paymentMethods
  });
});

const createPaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const paymentMethod = await PaymentService.createPaymentMethod(
    userId,
    req.body.paymentMethodId
  );
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment method added successfully",
    data: paymentMethod
  });
});

const deletePaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { paymentMethodId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.deletePaymentMethod(userId, paymentMethodId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

const setDefaultPaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { paymentMethodId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.setDefaultPaymentMethod(userId, paymentMethodId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

const getPayments = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.getPayments(userId, req.query);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully",
    data: result.payments,
    meta: result.meta
  });
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { paymentId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const payment = await PaymentService.getPaymentById(paymentId, userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment retrieved successfully",
    data: payment
  });
});

const getInvoices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.getInvoices(userId, req.query);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoices retrieved successfully",
    data: result.invoices,
    meta: result.meta
  });
});

const getInvoiceById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { invoiceId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const invoice = await PaymentService.getInvoiceById(invoiceId, userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoice retrieved successfully",
    data: invoice
  });
});

const downloadInvoice = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { invoiceId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.downloadInvoice(invoiceId, userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoice download URL retrieved",
    data: result
  });
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { paymentId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.refundPayment(paymentId, userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: { refundId: result.refund.id }
  });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.cancelSubscription(userId, req.body.reason);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "result.message",
    data: result
  });
});

const getBillingPortalSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await PaymentService.getBillingPortalSession(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Billing portal session created",
    data: result
  });
});

const getPaymentStatistics = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const stats = await PaymentService.getPaymentStatistics(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment statistics retrieved",
    data: stats
  });
});

export const PaymentController = {
  getAvailablePlans,
  getPlanById,
  createCheckoutSession,
  createDirectPayment,
  handleWebhook,
  getPaymentMethods,
  createPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getPayments,
  getPaymentById,
  getInvoices,
  getInvoiceById,
  downloadInvoice,
  refundPayment,
  cancelSubscription,
  getBillingPortalSession,
  getPaymentStatistics
};