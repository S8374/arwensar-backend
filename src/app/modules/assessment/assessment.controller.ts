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

  const assessment = await AssessmentService.getAssessmentById(assessmentId, userId);

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

  const result = await AssessmentService.getSubmissions(userId, req.query); // ✅ Correct

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

  const submission = await AssessmentService.getSubmissionById(submissionId, userId);

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

  const submission = await AssessmentService.startAssessment(userId, assessmentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment started successfully",
    data: submission
  });
});

const saveAnswer = catchAsync(async (req: Request, res: Response) => {
  console.log("Saving answersssssssssssssssssssssssssssssssss", req.body);
  const userId = req.user?.userId;
  const { submissionId, questionId } = req.params;
  console.log("User IDsssssssssssssssss:", userId);
  console.log("Saving answer for submission:", submissionId, "question:", questionId);
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const answer = await AssessmentService.saveAnswer(
    submissionId,
    questionId,
    userId,
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
    submissionId,
    userId,
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
  console.log("review hit",req.body) ;
  console.log("req user",req.user);
  console.log("req params", req.params)
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
    submissionId,
    userId,
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
    answerId,
    userId,
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
    answerId,
    userId,
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
  console.log("Getting draft submission", req.params, req.user);
  const userId = req.user?.userId;
  const { submissionId } = req.params;
  console.log("User IDsssssssssssssssss:", userId);
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const submission = await AssessmentService.getDraftSubmissionById(submissionId, userId);

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
    answerId,
    userId,
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

    const result = await AssessmentService.getSubmissionsByUserId(userId, options);

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