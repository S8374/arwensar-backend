// src/modules/problem/problem.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { ProblemService } from "./problem.service";
import catchAsync from "../../shared/catchAsync";

const createProblem = catchAsync(async (req: Request, res: Response) => {
  console.log("Request Body:", req.body);
  console.log("User Info:", req.user);
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const problem = await ProblemService.createProblem(userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Problem created successfully",
    data: problem
  });
});

const getProblems = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await ProblemService.getProblems(userId, req.query);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Problems retrieved successfully",
    data: result.problems,
    meta: result.meta
  });
});

const getProblemById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { problemId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const problem = await ProblemService.getProblemById(problemId as string, userId as string);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Problem retrieved successfully",
    data: problem
  });
});

const updateProblem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { problemId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const problem = await ProblemService.updateProblem(problemId as string, userId as string, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Problem updated successfully",
    data: problem
  });
});

const createMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { problemId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const message = await ProblemService.createMessage(problemId as string, userId as string, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message sent successfully",
    data: message
  });
});

const getProblemStatistics = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const stats = await ProblemService.getProblemStatistics(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Problem statistics retrieved successfully",
    data: stats
  });
});

const deleteProblem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { problemId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await ProblemService.deleteProblem(problemId as string, userId as string);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

export const ProblemController = {
  createProblem,
  getProblems,
  getProblemById,
  updateProblem,
  createMessage,
  getProblemStatistics,
  deleteProblem
};