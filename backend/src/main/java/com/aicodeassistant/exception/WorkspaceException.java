package com.aicodeassistant.exception;

import org.springframework.http.HttpStatus;

/**
 * Stable Project/workspace failure returned through the REST error envelope.
 */
public class WorkspaceException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public WorkspaceException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
