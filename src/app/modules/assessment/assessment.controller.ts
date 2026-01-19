// src/modules/assessment/assessment.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { AssessmentService } from "./assessment.service";
import catchAsync from "../../shared/catchAsync";

const getAssessments = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await AssessmentService.getAssessments(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessments retrieved successfully",
    data: result.assessments,
    meta: result.meta
  });
});

const getAssessmentById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { assessmentId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const assessment = await AssessmentService.getAssessmentById(assessmentId as string, userId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment retrieved successfully",
    data: assessment
  });
});

const getSubmissions = catchAsync(async (req: Request, res: Response) => {
  console.log("Hits.................................................")

  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await AssessmentService.getSubmissions(userId as string, req.query); // ✅ Correct

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submissions retrieved successfully",
    data: result.submissions,
    meta: result.meta
  });
});

const getSubmissionById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { submissionId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const submission = await AssessmentService.getSubmissionById(submissionId as string,  userId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission retrieved successfully",
    data: submission
  });
});

const startAssessment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { assessmentId } = req.body;
  console.log("Starting assessment", assessmentId, userId);
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const submission = await AssessmentService.startAssessment(userId as string, assessmentId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment started successfully",
    data: submission
  });
});

const saveAnswer = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { submissionId, questionId } = req.params;
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const answer = await AssessmentService.saveAnswer(
    submissionId as string,
    questionId as string,
    userId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Answer saved successfully",
    data: answer
  });
});

const submitAssessment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { submissionId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const submission = await AssessmentService.submitAssessment(
    submissionId as string,
    userId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment submitted successfully",
    data: submission
  });
});

const reviewAssessment = catchAsync(async (req: Request, res: Response) => {

  const userId = req.user?.userId;
  const { submissionId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const submission = await AssessmentService.reviewAssessment(
    submissionId as string,
    userId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment reviewed successfully",
    data: submission
  });
});

const reviewEvidence = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { answerId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const answer = await AssessmentService.reviewEvidence(
    answerId as string,
    userId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Evidence reviewed successfully",
    data: answer
  });
});

const getAssessmentStatistics = catchAsync(async (req: Request, res: Response) => {
  console.log("Getting assessment statistics", req.body);
  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const stats = await AssessmentService.getAssessmentStatistics(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment statistics retrieved successfully",
    data: stats
  });
});

const requestEvidence = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { answerId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const answer = await AssessmentService.requestEvidence(
    answerId as string,
    userId as string,
    req.body.reason
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Evidence requested successfully",
    data: answer
  });
});

const getDraftSubmissionById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { submissionId } = req.params;
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const submission = await AssessmentService.getDraftSubmissionById(submissionId as string, userId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Draft submission retrieved successfully",
    data: submission
  });
});
// src/modules/assessment/assessment.controller.ts (add this method)
const removeEvidence = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { answerId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const answer = await AssessmentService.removeEvidence(
    answerId as string,
    userId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Evidence removed successfully",
    data: answer
  });
});

const getSubmissionsByUserId = catchAsync(async (req: Request, res: Response) => {
    const { userId } = req.params; // Fixed extra dot
    const options = req.query; // For pagination, filters

    const result = await AssessmentService.getSubmissionsByUserId(userId as string, options );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Submissions retrieved successfully",
      meta: result.meta,
      data: result.submissions,
    });
  }
);

export const AssessmentController = {
  getAssessments,
  getAssessmentById,
  getSubmissions,
  getSubmissionById,
  startAssessment,
  saveAnswer,
  submitAssessment,
  reviewAssessment,
  reviewEvidence,
  getAssessmentStatistics,
  requestEvidence,
  getDraftSubmissionById,
  removeEvidence ,
  getSubmissionsByUserId
};