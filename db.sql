CREATE TABLE DELETED_GROUNDS(
USER_ID INT,
CAMP_ID INT PRIMARY KEY,
CAMP_NAME VARCHAR(1000)
);

CREATE TABLE TRAN(
TRANSACTION_ID INT PRIMARY KEY,
PRICE FLOAT
);

CREATE TABLE CANCELLATION(
CANCELLATION_ID INT PRIMARY KEY,
TRANSACTION_ID INT,
BOOKING_ID VARCHAR(255),
FOREIGN KEY (TRANSACTION_ID) REFERENCES TRAN(TRANSACTION_ID)
);

CREATE SEQUENCE tran_seq START WITH 1;

CREATE OR REPLACE TRIGGER tran_seqt
BEFORE INSERT ON tran
FOR EACH ROW

BEGIN
  SELECT tran_seq.NEXTVAL
  INTO   :new.transaction_id
  FROM   dual;
END;
/

CREATE SEQUENCE can_seq START WITH 1;
--cancellation wala trigger
CREATE OR REPLACE TRIGGER can_seqt
BEFORE INSERT ON CANCELLATION
FOR EACH ROW

BEGIN
  SELECT tran_seq.NEXTVAL
  INTO   :new.CANCELLATION_ID
  FROM   dual;
END;
/

ALTER TABLE BOOKING ADD TRANSACTION_ID INT REFERENCES TRAN(TRANSACTION_ID);

CREATE OR REPLACE trigger CREATE_TRAN
BEFORE INSERT ON BOOKING
FOR each ROW

begin
    insert into tran values(999999,:new.amount);

    select tran_seq.CURRVAL
    INTO :NEW.transaction_id
    from dual;
end;
/

CREATE OR REPLACE TRIGGER DEL_GROUND
after DELETE ON CAMPGROUNDS
FOR each row

begin
INSERT INTO DELETED_GROUNDS VALUES (:OLD.USER_ID,:OLD.ID,:OLD.CAMPNAME);
END;
/

CREATE OR REPLACE TRIGGER CANCEL_BOOKING
AFTER DELETE ON BOOKING
FOR EACH row
begin
INSERT INTO CANCELLATION VALUES(99999, :OLD.TRANSACTION_ID, :OLD.BOOKING_ID);
END;
/




SQL> desc campgrounds;
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 ID                                        NOT NULL NUMBER(38)
 DESCRIPTION                                        VARCHAR2(3999)
 CAMPNAME                                           VARCHAR2(100)
 IMGURL                                             VARCHAR2(1000)
 LOCATION                                           VARCHAR2(100)
 PRICE                                              NUMBER(38)
 USER_ID                                            NUMBER(38)

SQL> desc users;
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 USER_ID                                   NOT NULL NUMBER(38)
 NAME                                               VARCHAR2(100)
 CITY                                               VARCHAR2(50)
 DISTRICT                                           VARCHAR2(50)
 PHONE_NO                                           NUMBER(10)
 EMAIL                                              VARCHAR2(100)
 PASSWORD                                           VARCHAR2(100)
 BANNED                                             NUMBER(1)

SQL> desc comments;
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 COMMENT_ID                                NOT NULL NUMBER(38)
 CONTENT                                            VARCHAR2(3999)
 USER_ID                                   NOT NULL NUMBER(38)
 CAMP_ID                                   NOT NULL NUMBER(38)

SQL> desc booking
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 BOOKING_ID                                NOT NULL VARCHAR2(255)
 START_F                                            DATE
 END_T                                              DATE
 AMOUNT                                             FLOAT(126)
 CAMP_ID                                   NOT NULL NUMBER
 USER_ID                                   NOT NULL NUMBER
 TOTAL_PEOPLE                                       NUMBER
 TRANSACTION_ID                                     NUMBER(38)

SQL> desc cancellation
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 CANCELLATION_ID                           NOT NULL NUMBER(38)
 TRANSACTION_ID                                     NUMBER(38)
 BOOKING_ID                                         VARCHAR2(255)

SQL> desc tran
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 TRANSACTION_ID                            NOT NULL NUMBER(38)
 PRICE                                              FLOAT(126)


SQL> desc deleted_grounds;
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 USER_ID                                            NUMBER(38)
 CAMP_ID                                   NOT NULL NUMBER(38)
 CAMP_NAME                                          VARCHAR2(1000)