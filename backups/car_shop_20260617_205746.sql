--
-- PostgreSQL database dump
--

\restrict upfVwrOMhm597UtfovzHasyzic3scsAVOXjTOGMbaJWFifybzEOQPkubtVyAcPR

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: app_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_devices (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    "deviceToken" text NOT NULL,
    platform text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text NOT NULL,
    "customerId" text NOT NULL,
    "vehicleId" text,
    "serviceType" text NOT NULL,
    "appointTime" timestamp(3) without time zone NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "tenantId" text,
    "userId" text,
    action text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text,
    changes jsonb,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: coupon_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_claims (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "couponId" text NOT NULL,
    "customerId" text NOT NULL,
    status text DEFAULT 'unused'::text NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "expiredAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "discountValue" numeric(12,2) NOT NULL,
    "conditionAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "validDays" integer DEFAULT 30 NOT NULL,
    "totalQuantity" integer DEFAULT 0 NOT NULL,
    "issuedQuantity" integer DEFAULT 0 NOT NULL,
    "usedQuantity" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    gender text,
    email text,
    address text,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: dictionaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dictionaries (
    id text NOT NULL,
    "tenantId" text,
    type text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: dispatch_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_tasks (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "workOrderId" text NOT NULL,
    "technicianId" text NOT NULL,
    "itemIds" text,
    status text DEFAULT 'pending'::text NOT NULL,
    "startAt" timestamp(3) without time zone,
    "endAt" timestamp(3) without time zone,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assistantIds" text,
    team text,
    "workPlace" text
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text NOT NULL,
    "position" text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "uploadedBy" text NOT NULL,
    "originalName" text NOT NULL,
    "fileName" text NOT NULL,
    "mimeType" text NOT NULL,
    size integer NOT NULL,
    url text NOT NULL,
    source text,
    "businessType" text,
    "businessId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inspection_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_records (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "workOrderId" text NOT NULL,
    category text NOT NULL,
    item text NOT NULL,
    condition text NOT NULL,
    note text,
    "photoUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text,
    channel text NOT NULL,
    scene text NOT NULL,
    recipient text NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "failReason" text,
    "relatedType" text,
    "relatedId" text,
    "sentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: package_card_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_card_items (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardId" text NOT NULL,
    "serviceItemId" text NOT NULL,
    "totalQty" numeric(10,2) NOT NULL,
    "remainQty" numeric(10,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: package_card_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_card_transactions (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardId" text NOT NULL,
    "itemId" text NOT NULL,
    type text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    "remainAfter" numeric(10,2) NOT NULL,
    "relatedType" text,
    "relatedId" text,
    "operatorId" text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: package_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_cards (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardNo" text NOT NULL,
    "customerId" text NOT NULL,
    "vehicleId" text,
    "shopIds" text,
    "templateId" text,
    name text NOT NULL,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parts (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text,
    brand text,
    unit text DEFAULT '个'::text NOT NULL,
    "costPrice" numeric(12,2) DEFAULT 0 NOT NULL,
    "salePrice" numeric(12,2) DEFAULT 0 NOT NULL,
    "minStock" integer DEFAULT 0 NOT NULL,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "supplierId" text,
    "warrantyMonths" integer DEFAULT 0 NOT NULL
);


--
-- Name: payment_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_refunds (
    id text NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    "callbackData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "operatorId" text NOT NULL,
    "outRefundNo" text,
    "paymentId" text NOT NULL,
    "refundNo" text NOT NULL,
    "tenantId" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "settlementId" text,
    "payMethod" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "referenceNo" text,
    "cardId" text,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text DEFAULT 'paid'::text NOT NULL,
    "callbackData" jsonb,
    "expiredAt" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "refundAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "transactionId" text
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    module text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: receptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receptions (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text NOT NULL,
    "customerId" text NOT NULL,
    "vehicleId" text NOT NULL,
    "advisorId" text NOT NULL,
    "appointmentId" text,
    "arriveTime" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text,
    status text DEFAULT 'receiving'::text NOT NULL,
    "workOrderId" text,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminders (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text,
    type text NOT NULL,
    "customerId" text NOT NULL,
    "vehicleId" text,
    "relatedId" text,
    content text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "handledBy" text,
    "handledAt" timestamp(3) without time zone,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id text NOT NULL,
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id text NOT NULL,
    "tenantId" text,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    "isBuiltIn" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sequences (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    key text NOT NULL,
    date text NOT NULL,
    value integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: service_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_items (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    unit text DEFAULT '次'::text NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    description text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlements (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text NOT NULL,
    "settleNo" text NOT NULL,
    "workOrderId" text NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "discountAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "payableAmount" numeric(12,2) NOT NULL,
    "paidAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "debtAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'settled'::text NOT NULL,
    remark text,
    "operatorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: shops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shops (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_balances (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "partId" text NOT NULL,
    quantity numeric(12,2) DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: stock_bill_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_bill_items (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "billId" text NOT NULL,
    "partId" text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    amount numeric(12,2) NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: stock_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_bills (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text NOT NULL,
    "billNo" text NOT NULL,
    "billType" text NOT NULL,
    "supplierId" text,
    "relatedType" text,
    "relatedId" text,
    status text DEFAULT 'draft'::text NOT NULL,
    remark text,
    "operatorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "partId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "movementType" text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    "balanceAfter" numeric(12,2) NOT NULL,
    "billId" text,
    "billItemId" text,
    "relatedType" text,
    "relatedId" text,
    "operatorId" text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: stored_value_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stored_value_cards (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardNo" text NOT NULL,
    "customerId" text NOT NULL,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    "principalBalance" numeric(12,2) DEFAULT 0 NOT NULL,
    "giftBalance" numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: stored_value_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stored_value_transactions (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "cardId" text NOT NULL,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    principal numeric(12,2) DEFAULT 0 NOT NULL,
    gift numeric(12,2) DEFAULT 0 NOT NULL,
    "balanceAfter" numeric(12,2) NOT NULL,
    "relatedType" text,
    "relatedId" text,
    "operatorId" text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: subscription_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_orders (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "orderNo" text NOT NULL,
    "planId" text NOT NULL,
    months integer NOT NULL,
    "originalAmount" numeric(12,2) NOT NULL,
    "discountRate" numeric(4,2) DEFAULT 1.0 NOT NULL,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "paymentMethod" text,
    "transactionId" text,
    "paidAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "priceYearly" numeric(12,2) NOT NULL,
    "maxShops" integer NOT NULL,
    "maxEmployees" integer NOT NULL,
    features jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    discount12m numeric(4,2) DEFAULT 0.80 NOT NULL,
    discount3m numeric(4,2) DEFAULT 0.95 NOT NULL,
    discount6m numeric(4,2) DEFAULT 0.90 NOT NULL,
    "priceMonthly" numeric(12,2)
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    "contactName" text,
    phone text,
    address text,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: system_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_parameters (
    id text NOT NULL,
    "tenantId" text,
    "group" text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: tenant_feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_feature_flags (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "featureFlagId" text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenant_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_subscriptions (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "planId" text NOT NULL,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    name text NOT NULL,
    "contactName" text,
    "contactPhone" text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "subscriptionEndAt" timestamp(3) without time zone,
    "subscriptionStatus" text DEFAULT 'trial'::text NOT NULL,
    "businessType" text,
    "employeeCount" integer
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id text NOT NULL,
    "userId" text NOT NULL,
    "roleId" text NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    "tenantId" text,
    phone text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    avatar text,
    "isPlatform" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "wxOpenid" text
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "customerId" text NOT NULL,
    "plateNo" text NOT NULL,
    brand text,
    model text,
    vin text,
    "engineNo" text,
    color text,
    mileage integer,
    "firstRegDate" timestamp(3) without time zone,
    remark text,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text NOT NULL,
    name text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: work_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_items (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "workOrderId" text NOT NULL,
    "serviceItemId" text,
    "itemType" text NOT NULL,
    name text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT '次'::text NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    amount numeric(12,2) NOT NULL,
    "technicianId" text,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "partId" text,
    "supplierId" text,
    "warrantyMonths" integer,
    "warrantyUntil" timestamp(3) without time zone
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "shopId" text NOT NULL,
    "orderNo" text NOT NULL,
    "orderType" text NOT NULL,
    "customerId" text NOT NULL,
    "vehicleId" text NOT NULL,
    "vehiclePlateNo" text NOT NULL,
    "vehicleMileage" integer,
    "advisorId" text,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    "totalAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "payableAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    remark text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "expectDate" timestamp(3) without time zone
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
164d5481-1128-4e3b-9ed4-79b9077b5761	38c470017a65e06e1a0ba43afd325a2b65b88b38f537b55dbf2c4e60a55c45ff	2026-06-14 16:34:52.190344+00	20260528164304_init	\N	\N	2026-06-14 16:34:51.965542+00	1
3d33f9c5-8480-4468-a0ab-6fd0739344e2	c38e91466929bb6da817a2b8dd01f85fff29f8d0621f2e880c37b56890e4adcb	2026-06-14 16:34:52.724138+00	20260613200000_add_onboarding_fields	\N	\N	2026-06-14 16:34:52.717711+00	1
057c555f-a0e1-444b-9420-54f00149b574	c302120b747a9c641709a59ebe9f30fbcdba36b5ca56fbdbb76095e926d1af46	2026-06-14 16:34:52.328632+00	20260528170320_sprint1	\N	\N	2026-06-14 16:34:52.19215+00	1
3cacb97a-cdbf-4d98-87bb-5e8e1ba99571	1a05e8826ab7e1a6762143204865bc2ed73663f9bb0ca5528659debf3df308d5	2026-06-14 16:34:52.441454+00	20260528172623_sprint2	\N	\N	2026-06-14 16:34:52.329701+00	1
c86752bd-7245-493a-9522-05637a3e96d0	055d12fdb22a006557acf965500d2154e4a2cb5da8f51987dcc4a7a4c20ba8ff	2026-06-14 16:34:52.549035+00	20260528174953_sprint3	\N	\N	2026-06-14 16:34:52.442839+00	1
e16c1177-d114-4feb-8c76-d0d396dc03be	2db63790aae479e32cf197f3d4752c27b82225ba93138153ac8b291e62d55b7f	2026-06-14 16:34:52.72994+00	20260614120000_add_warranty_snapshot_to_work_order_item	\N	\N	2026-06-14 16:34:52.725305+00	1
53df860a-d8e9-4bab-97f7-99c06f5556c6	2017803fb8bb52c0b90e86fef186945b917df592f3fa13dbc159e10d1a81f72e	2026-06-14 16:34:52.556962+00	20260528211625_part_supplier	\N	\N	2026-06-14 16:34:52.550248+00	1
c057ce2c-cd92-46ff-8929-0e8bc03d87de	ee7b1cac543e7874e2a0da113b5039037f480ae9bfca43077d7766271ecc70d1	2026-06-14 16:34:52.567272+00	20260530025058_add_part_relation_to_work_order_item	\N	\N	2026-06-14 16:34:52.558306+00	1
8b6967c5-ef99-4641-bde4-849a9181748d	20b17518765a3261062fe0bc55bce2ca06620d3f20498c5e61cb6690b6843776	2026-06-14 16:34:52.57363+00	20260530034814_add_dispatch_advancement	\N	\N	2026-06-14 16:34:52.568579+00	1
36a30a00-de2e-4216-88e3-493429c382c3	5159be71c7b835e0656fc09d6440885e38b62e00fe8df07aebd1032bdcb62f8d	2026-06-14 16:34:52.786672+00	20260614163500_make_payment_settlement_optional	\N	\N	2026-06-14 16:34:52.731267+00	1
4926a5a0-e119-43b0-b039-c1bc14907c10	5f9229d35e9d1bc75bbe5aa78178672c739c65b74835d286e151b68c32250ce3	2026-06-14 16:34:52.596798+00	20260602012426_add_sequence_table	\N	\N	2026-06-14 16:34:52.575022+00	1
3a93b8ef-6a68-458f-a23c-39e7e9bd7a3f	f4d115057c7b9fbe229c8c2fa1df947b7ec353e573160c08e4d7107b6b732a58	2026-06-14 16:34:52.604064+00	20260612231708_add_subscription_lifecycle	\N	\N	2026-06-14 16:34:52.59825+00	1
3032292a-50fd-48cb-8076-6d88fe829801	b561f44d2aeb0546e24936fadc5ae5f312acd015b12d80bef67045f31937050e	2026-06-14 16:34:52.621965+00	20260612235601_add_notifications	\N	\N	2026-06-14 16:34:52.605632+00	1
e9991351-e207-4dc1-ac11-79f7a98cdf0b	8ed0f27afe4dc03f49c0b23f08b96e0a6e40d7e1bfab2051e6dc65e22160a826	2026-06-17 15:24:27.460994+00	20260617150000_add_unique_user_phone	\N	\N	2026-06-17 15:24:27.446411+00	1
8f857a74-68dc-448b-ad64-5792436989b9	15681013ae5e8f6925480d8f978c75d83dca6d14e30626dc890e539206bbf3cd	2026-06-14 16:34:52.650488+00	20260613130200_add_reminders	\N	\N	2026-06-14 16:34:52.623417+00	1
c24cd6e3-eb41-4610-9dc1-2c7297101bad	c40800233cff89527b0193c0874e68844becd40854a3718269824adbbd7db6d1	2026-06-14 16:34:52.674705+00	20260613150000_add_payment_gateway	\N	\N	2026-06-14 16:34:52.651814+00	1
4e49c217-4b3b-41ea-b38c-fb6e287964a1	221c1ee23d45781558bc85a300de4f8a3bdda2c9d2df4e7b45b0f4b0dea2af7d	2026-06-14 16:34:52.716554+00	20260613180000_add_coupon_marketing	\N	\N	2026-06-14 16:34:52.675671+00	1
\.


--
-- Data for Name: app_devices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_devices (id, "tenantId", "userId", "deviceToken", platform, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointments (id, "tenantId", "shopId", "customerId", "vehicleId", "serviceType", "appointTime", description, status, remark, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, "tenantId", "userId", action, "targetType", "targetId", changes, ip, "createdAt") FROM stdin;
cmqe4hgkz0004x18fuctp04nr	e2e-306-tenant	e2e-306-admin-user	subscription_order_create	SubscriptionOrder	cmqe4hgkx0002x18f7qkw4goa	{"amount": 2384, "months": 12, "planId": "plan-basic", "orderNo": "SUB202606140004"}	\N	2026-06-14 18:33:30.42
cmqe4hgls0008x18f9aze412i	e2e-306-tenant	\N	payment_create	Payment	cmqe4hgla0006x18f5j1ayad8	{"amount": 2384, "method": "wechat", "codeUrl": "https://mock-pay.example.com/qr/cmqe4hgla0006x18f5j1ayad8"}	\N	2026-06-14 18:33:30.448
cmqe4hgmi000dx18f3bm1hni5	e2e-306-tenant	\N	subscription_purchase	SubscriptionOrder	cmqe4hgkx0002x18f7qkw4goa	{"amount": 2384, "months": 12, "planId": "plan-basic", "orderNo": "SUB202606140004"}	\N	2026-06-14 18:33:30.475
cmqekfnkz0001w9aapoxn7xv4	demo-tenant	\N	subscription_status_change	tenant	demo-tenant	{"to": "active", "from": "trial", "subscriptionId": "demo-sub"}	\N	2026-06-15 02:00:00.035
\.


--
-- Data for Name: coupon_claims; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupon_claims (id, "tenantId", "couponId", "customerId", status, "usedAt", "expiredAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupons (id, "tenantId", name, type, "discountValue", "conditionAmount", "validDays", "totalQuantity", "issuedQuantity", "usedQuantity", status, remark, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, "tenantId", name, phone, gender, email, address, remark, status, "createdAt", "updatedAt") FROM stdin;
cmqh5cukj000l3fjr9rdvsozd	cmqedif8y00011060n5q5wabc	苏伟	13658733979	\N	\N	\N	\N	active	2026-06-16 21:21:13.412	2026-06-16 21:21:13.412
cmqi2xmoy0003f3arlj9d68fu	gray-smoke-tenant	灰度测试客户_1781701270299	13900001111	male	\N	\N	\N	active	2026-06-17 13:01:10.307	2026-06-17 13:01:10.307
cmqi319or001jf3arxxneko18	gray-smoke-tenant	灰度测试客户_1781701440068	13901440068	male	\N	\N	\N	active	2026-06-17 13:04:00.075	2026-06-17 13:04:00.075
cmqi32kog0003gto8ylxi507d	gray-smoke-tenant	灰度测试客户_1781701500968	13901500968	male	\N	\N	\N	active	2026-06-17 13:05:00.977	2026-06-17 13:05:00.977
cmqi33c9s001hgto8ufiivpgj	gray-smoke-tenant	灰度测试客户_1781701536729	13901536729	male	\N	\N	\N	active	2026-06-17 13:05:36.736	2026-06-17 13:05:36.736
cmqi4yn8m0003ylklmbrai9qw	gray-smoke-tenant	灰度测试客户_1781704676891	13904676891	male	\N	\N	\N	active	2026-06-17 13:57:56.902	2026-06-17 13:57:56.902
\.


--
-- Data for Name: dictionaries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dictionaries (id, "tenantId", type, code, name, sort, status, "createdAt", "updatedAt") FROM stdin;
cmqedifc1005j1060sej55yli	cmqedif8y00011060n5q5wabc	business_type	repair	维修	1	active	2026-06-14 22:46:12.001	2026-06-14 22:46:12.001
cmqedifc3005l106075mhc3lg	cmqedif8y00011060n5q5wabc	business_type	maintenance	保养	2	active	2026-06-14 22:46:12.003	2026-06-14 22:46:12.003
cmqedifc4005n10606tebbrto	cmqedif8y00011060n5q5wabc	business_type	wash	洗美	3	active	2026-06-14 22:46:12.004	2026-06-14 22:46:12.004
cmqedifc5005p1060agchs2ls	cmqedif8y00011060n5q5wabc	business_type	tire	轮胎	4	active	2026-06-14 22:46:12.006	2026-06-14 22:46:12.006
cmqedifc6005r1060n7636eq9	cmqedif8y00011060n5q5wabc	business_type	other	其他	5	active	2026-06-14 22:46:12.007	2026-06-14 22:46:12.007
cmqedifc7005t10606q7gtyul	cmqedif8y00011060n5q5wabc	payment_method	cash	现金	1	active	2026-06-14 22:46:12.008	2026-06-14 22:46:12.008
cmqedifc8005v10608yph3kf7	cmqedif8y00011060n5q5wabc	payment_method	wechat	微信支付	2	active	2026-06-14 22:46:12.009	2026-06-14 22:46:12.009
cmqedifc9005x1060tuia8mnw	cmqedif8y00011060n5q5wabc	payment_method	alipay	支付宝	3	active	2026-06-14 22:46:12.01	2026-06-14 22:46:12.01
cmqedifcb005z1060yo3dac5r	cmqedif8y00011060n5q5wabc	payment_method	card	银行卡	4	active	2026-06-14 22:46:12.011	2026-06-14 22:46:12.011
cmqedifcc00611060a5w11ich	cmqedif8y00011060n5q5wabc	payment_method	stored_value	储值卡	5	active	2026-06-14 22:46:12.012	2026-06-14 22:46:12.012
cmqedifcc0063106016nbi3zm	cmqedif8y00011060n5q5wabc	payment_method	package_card	套餐卡	6	active	2026-06-14 22:46:12.013	2026-06-14 22:46:12.013
cmqedifcd006510607cxsgsqa	cmqedif8y00011060n5q5wabc	car_color	white	白色	1	active	2026-06-14 22:46:12.014	2026-06-14 22:46:12.014
cmqedifce00671060uno7jsju	cmqedif8y00011060n5q5wabc	car_color	black	黑色	2	active	2026-06-14 22:46:12.015	2026-06-14 22:46:12.015
cmqedifcf00691060i282xue0	cmqedif8y00011060n5q5wabc	car_color	silver	银色	3	active	2026-06-14 22:46:12.016	2026-06-14 22:46:12.016
cmqedifcg006b10607083tsws	cmqedif8y00011060n5q5wabc	car_color	gray	灰色	4	active	2026-06-14 22:46:12.016	2026-06-14 22:46:12.016
cmqedifch006d1060sv5clt1g	cmqedif8y00011060n5q5wabc	car_color	red	红色	5	active	2026-06-14 22:46:12.017	2026-06-14 22:46:12.017
cmqedifci006f1060n14lucox	cmqedif8y00011060n5q5wabc	car_color	blue	蓝色	6	active	2026-06-14 22:46:12.018	2026-06-14 22:46:12.018
cmqedifcj006h1060efginsas	cmqedif8y00011060n5q5wabc	car_color	other	其他	7	active	2026-06-14 22:46:12.019	2026-06-14 22:46:12.019
cmqedifck006j1060vbr3xiy7	cmqedif8y00011060n5q5wabc	order_type	repair	维修	1	active	2026-06-14 22:46:12.02	2026-06-14 22:46:12.02
cmqedifcl006l10609w1rols6	cmqedif8y00011060n5q5wabc	order_type	wash	洗车	2	active	2026-06-14 22:46:12.021	2026-06-14 22:46:12.021
cmqedifcm006n1060bo25unug	cmqedif8y00011060n5q5wabc	order_type	quick	快修	3	active	2026-06-14 22:46:12.022	2026-06-14 22:46:12.022
cmqi2s6pu006l99bqyr4xf5da	gray-smoke-tenant	payment_method	package_card	套餐卡	6	active	2026-06-17 12:56:56.322	2026-06-17 13:56:20.056
cmqi2s6pw006n99bq1ln77gxf	gray-smoke-tenant	car_color	white	白色	1	active	2026-06-17 12:56:56.324	2026-06-17 13:56:20.059
cmqi2s6px006p99bq67bi26wd	gray-smoke-tenant	car_color	black	黑色	2	active	2026-06-17 12:56:56.326	2026-06-17 13:56:20.061
cmqi2s6pz006r99bq0ywc4o7a	gray-smoke-tenant	car_color	silver	银色	3	active	2026-06-17 12:56:56.328	2026-06-17 13:56:20.063
cmqi2s6q1006t99bqatkd6b82	gray-smoke-tenant	car_color	gray	灰色	4	active	2026-06-17 12:56:56.329	2026-06-17 13:56:20.066
cmqi2s6pb006199bqvifm6n1m	gray-smoke-tenant	business_type	repair	维修	1	active	2026-06-17 12:56:56.303	2026-06-17 13:56:20.009
cmqi2s6pd006399bqnte3lvt1	gray-smoke-tenant	business_type	maintenance	保养	2	active	2026-06-17 12:56:56.306	2026-06-17 13:56:20.012
cmqi2s6pf006599bq8d6e79ic	gray-smoke-tenant	business_type	wash	洗美	3	active	2026-06-17 12:56:56.308	2026-06-17 13:56:20.016
cmqi2s6ph006799bqslgzbl9r	gray-smoke-tenant	business_type	tire	轮胎	4	active	2026-06-17 12:56:56.31	2026-06-17 13:56:20.024
cmqi2s6pj006999bqn9vbhl0l	gray-smoke-tenant	business_type	other	其他	5	active	2026-06-17 12:56:56.311	2026-06-17 13:56:20.031
cmqi2s6pl006b99bqoqtvy7ar	gray-smoke-tenant	payment_method	cash	现金	1	active	2026-06-17 12:56:56.313	2026-06-17 13:56:20.041
cmqi2s6pm006d99bqyaau7p99	gray-smoke-tenant	payment_method	wechat	微信支付	2	active	2026-06-17 12:56:56.315	2026-06-17 13:56:20.047
cmqi2s6po006f99bqjwdgvehz	gray-smoke-tenant	payment_method	alipay	支付宝	3	active	2026-06-17 12:56:56.316	2026-06-17 13:56:20.049
cmqi2s6pq006h99bqpsjk2cc0	gray-smoke-tenant	payment_method	card	银行卡	4	active	2026-06-17 12:56:56.318	2026-06-17 13:56:20.051
cmqi2s6ps006j99bqolme4rxm	gray-smoke-tenant	payment_method	stored_value	储值卡	5	active	2026-06-17 12:56:56.32	2026-06-17 13:56:20.054
cmqi2s6q3006v99bq6iq84zet	gray-smoke-tenant	car_color	red	红色	5	active	2026-06-17 12:56:56.331	2026-06-17 13:56:20.068
cmqi2s6q4006x99bq25xtt1ys	gray-smoke-tenant	car_color	blue	蓝色	6	active	2026-06-17 12:56:56.332	2026-06-17 13:56:20.07
cmqi2s6q6006z99bqr6i182wf	gray-smoke-tenant	car_color	other	其他	7	active	2026-06-17 12:56:56.334	2026-06-17 13:56:20.073
cmqi2s6q7007199bqtae4u5e7	gray-smoke-tenant	order_type	repair	维修	1	active	2026-06-17 12:56:56.336	2026-06-17 13:56:20.075
cmqi2s6q9007399bqq8qmjo6a	gray-smoke-tenant	order_type	wash	洗车	2	active	2026-06-17 12:56:56.337	2026-06-17 13:56:20.078
cmqi2s6qa007599bqk3j6wegy	gray-smoke-tenant	order_type	quick	快修	3	active	2026-06-17 12:56:56.339	2026-06-17 13:56:20.082
\.


--
-- Data for Name: dispatch_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dispatch_tasks (id, "tenantId", "workOrderId", "technicianId", "itemIds", status, "startAt", "endAt", remark, "createdAt", "updatedAt", "assistantIds", team, "workPlace") FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, "userId", "tenantId", "shopId", "position", status, "createdAt", "updatedAt") FROM stdin;
cmqedpxot0003to7digce66r0	demo-admin	demo-tenant	cmqedpxon0001to7dpgta55pg	管理员	active	2026-06-14 22:52:02.381	2026-06-14 22:52:02.381
cmqedpxp70007to7dqgyyszq2	e2e-306-admin-user	e2e-306-tenant	cmqedpxp00005to7dwpoxqxct	管理员	active	2026-06-14 22:52:02.395	2026-06-14 22:52:02.395
cmqedpxpd0009to7dembocho9	cmqedifaz003t1060t9nf8w3p	cmqedif8y00011060n5q5wabc	cmqedif9600051060bygff3ic	管理员	active	2026-06-14 22:52:02.401	2026-06-14 22:52:02.401
cmqi2s6nl004d99bq47q6z4oz	gray-smoke-admin	gray-smoke-tenant	gray-smoke-shop	管理员	active	2026-06-17 12:56:56.241	2026-06-17 13:56:19.893
\.


--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feature_flags (id, code, name, description, "createdAt") FROM stdin;
flag-simple-mode	simple_mode	简易模式	面向小型门店隐藏派工/仓库/预检等高级功能，核心体验压缩为车牌→选项目→收钱	2026-06-14 16:35:00.222
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.files (id, "tenantId", "uploadedBy", "originalName", "fileName", "mimeType", size, url, source, "businessType", "businessId", "createdAt") FROM stdin;
cmqh2429x000f3fjrlsruefep	cmqedif8y00011060n5q5wabc	cmqedifaz003t1060t9nf8w3p	precheck_damage.jpg	cmqedif8y00011060n5q5wabc/1781639424624-x2f1jm3rij.jpg	image/jpeg	10240	https://objectstorage.ap-batam-1.oraclecloud.com/n/axl6ozaw08tj/b/batam/o/cmqedif8y00011060n5q5wabc/1781639424624-x2f1jm3rij.jpg	mobile	precheck	\N	2026-06-16 19:50:24.645
cmqh2gp55000h3fjre99sd9cy	cmqedif8y00011060n5q5wabc	cmqedifaz003t1060t9nf8w3p	precheck_damage.jpg	cmqedif8y00011060n5q5wabc/1781640014151-z129gyyuji.jpg	image/jpeg	10240	https://objectstorage.ap-batam-1.oraclecloud.com/n/axl6ozaw08tj/b/batam/o/cmqedif8y00011060n5q5wabc/1781640014151-z129gyyuji.jpg	mobile	precheck	\N	2026-06-16 20:00:14.154
\.


--
-- Data for Name: inspection_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_records (id, "tenantId", "workOrderId", category, item, condition, note, "photoUrl", "createdAt") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, "tenantId", "shopId", channel, scene, recipient, content, status, "failReason", "relatedType", "relatedId", "sentAt", "createdAt") FROM stdin;
cmqecxbfg00003fzqaecdgr43	platform	\N	sms	sms_verify_code	13658733979	您的验证码是 136586，5分钟内有效。	sent	\N	\N	\N	2026-06-14 22:29:47.167	2026-06-14 22:29:47.164
cmqed82mw00008pmrj0j8nf46	platform	\N	sms	sms_verify_code	13658733979	您的验证码是 583971，5分钟内有效。	sent	\N	\N	\N	2026-06-14 22:38:08.987	2026-06-14 22:38:08.984
cmqed9fnj00018pmrxe80b3c1	platform	\N	sms	sms_verify_code	13658733979	您的验证码是 578676，5分钟内有效。	sent	\N	\N	\N	2026-06-14 22:39:12.516	2026-06-14 22:39:12.511
cmqeddpoe0000tsl3p1ilrrzc	platform	\N	sms	sms_verify_code	13658733979	您的验证码是 448338，5分钟内有效。	sent	\N	\N	\N	2026-06-14 22:42:32.129	2026-06-14 22:42:32.126
cmqi32ktg000zgto8mj58wnc9	gray-smoke-tenant	gray-smoke-shop	sms	work_order_completed	13901500968	您的爱车 京A00980 已在 灰度验收门店（总店） 完成施工，可随时到店取车。	sent	\N	work_order	cmqi32kr5000ngto8bkaiofvi	2026-06-17 13:05:01.159	2026-06-17 13:05:01.157
cmqi33cdm002dgto80fu8ondn	gray-smoke-tenant	gray-smoke-shop	sms	work_order_completed	13901536729	您的爱车 京A36740 已在 灰度验收门店（总店） 完成施工，可随时到店取车。	sent	\N	work_order	cmqi33cbt0021gto8lsy3rtjj	2026-06-17 13:05:36.877	2026-06-17 13:05:36.875
cmqi4ynd3000zylkl02yut9bm	gray-smoke-tenant	gray-smoke-shop	sms	work_order_completed	13904676891	您的爱车 京A76906 已在 灰度验收门店（总店） 完成施工，可随时到店取车。	sent	\N	work_order	cmqi4ynb0000nylkl32kkpe61	2026-06-17 13:57:57.065	2026-06-17 13:57:57.063
\.


--
-- Data for Name: package_card_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.package_card_items (id, "tenantId", "cardId", "serviceItemId", "totalQty", "remainQty", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: package_card_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.package_card_transactions (id, "tenantId", "cardId", "itemId", type, quantity, "remainAfter", "relatedType", "relatedId", "operatorId", remark, "createdAt") FROM stdin;
\.


--
-- Data for Name: package_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.package_cards (id, "tenantId", "cardNo", "customerId", "vehicleId", "shopIds", "templateId", name, "startAt", "endAt", status, remark, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: parts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parts (id, "tenantId", code, name, category, brand, unit, "costPrice", "salePrice", "minStock", remark, status, "createdAt", "updatedAt", "supplierId", "warrantyMonths") FROM stdin;
cmqi2xmpo0007f3arufyhmhls	gray-smoke-tenant	SMOKE-1781701270323	机油滤芯	保养件	曼牌	个	25.00	45.00	5	\N	active	2026-06-17 13:01:10.332	2026-06-17 13:01:10.332	\N	6
cmqi30jx00013f3ar2t1ztvhk	gray-smoke-tenant	SMOKE-1781701406671	机油滤芯	保养件	曼牌	个	25.00	45.00	5	\N	active	2026-06-17 13:03:26.677	2026-06-17 13:03:26.677	\N	6
cmqi319pe001nf3arvsr3kzcz	gray-smoke-tenant	SMOKE-1781701440092	机油滤芯	保养件	曼牌	个	25.00	45.00	5	\N	active	2026-06-17 13:04:00.099	2026-06-17 13:04:00.099	\N	6
cmqi32kp70007gto8muyksek7	gray-smoke-tenant	SMOKE-1781701500994	机油滤芯	保养件	曼牌	个	25.00	45.00	5	\N	active	2026-06-17 13:05:01.003	2026-06-17 13:05:01.003	\N	6
cmqi33cad001lgto8rafrb6rk	gray-smoke-tenant	SMOKE-1781701536751	机油滤芯	保养件	曼牌	个	25.00	45.00	5	\N	active	2026-06-17 13:05:36.758	2026-06-17 13:05:36.758	\N	6
cmqi4yn9c0007ylkl3wmzdpxt	gray-smoke-tenant	SMOKE-1781704676919	机油滤芯	保养件	曼牌	个	25.00	45.00	5	\N	active	2026-06-17 13:57:56.928	2026-06-17 13:57:56.928	\N	6
\.


--
-- Data for Name: payment_refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_refunds (id, amount, reason, status, "callbackData", "createdAt", "operatorId", "outRefundNo", "paymentId", "refundNo", "tenantId", "updatedAt") FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, "tenantId", "settlementId", "payMethod", amount, "referenceNo", "cardId", remark, "createdAt", status, "callbackData", "expiredAt", "paidAt", "refundAmount", "transactionId") FROM stdin;
cmqe4hgla0006x18f5j1ayad8	e2e-306-tenant	\N	wechat	2384.00	SUB202606140004	\N	\N	2026-06-14 18:33:30.43	pending	\N	2026-06-14 18:48:30.444	\N	0.00	\N
cmqi32kv3001dgto8ticvmy28	gray-smoke-tenant	cmqi32kv2001bgto8knda31g6	cash	125.00	\N	\N	\N	2026-06-17 13:05:01.215	paid	\N	\N	\N	0.00	\N
cmqi33ceg002jgto857je5qqd	gray-smoke-tenant	cmqi33ceg002hgto8fp7xpkwn	cash	125.00	\N	\N	\N	2026-06-17 13:05:36.904	paid	\N	\N	\N	0.00	\N
cmqi4ynee0015ylklqzd7p9pi	gray-smoke-tenant	cmqi4ynee0013ylklrjq665sn	cash	125.00	\N	\N	\N	2026-06-17 13:57:57.11	paid	\N	\N	\N	0.00	\N
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions (id, code, name, module, description, "createdAt") FROM stdin;
cmqe0921z0000j0j0ahycs2sk	platform:tenant:view	查看商户	platform	\N	2026-06-14 16:34:59.88
cmqe092240001j0j0u8ibzywh	platform:tenant:create	创建商户	platform	\N	2026-06-14 16:34:59.885
cmqe092270002j0j01astxgcf	platform:tenant:update	编辑商户	platform	\N	2026-06-14 16:34:59.888
cmqe0922a0003j0j0tz8hfwsv	platform:tenant:delete	删除商户	platform	\N	2026-06-14 16:34:59.891
cmqe0922e0004j0j0vqdo5m80	platform:tenant:impersonate	代登录商户	platform	\N	2026-06-14 16:34:59.894
cmqe0922j0005j0j0gv3ntnc3	platform:tenant:manage	管理商户订阅	platform	\N	2026-06-14 16:34:59.899
cmqe0922m0006j0j0y9h8yk36	platform:plan:view	查看套餐	platform	\N	2026-06-14 16:34:59.902
cmqe0922p0007j0j0gcfody1q	platform:plan:manage	管理套餐	platform	\N	2026-06-14 16:34:59.906
cmqe0922s0008j0j0riswv8q6	platform:feature:manage	管理功能开关	platform	\N	2026-06-14 16:34:59.909
cmqe0922v0009j0j0a947kuhg	tenant:shop:view	查看门店	shop	\N	2026-06-14 16:34:59.912
cmqe0922y000aj0j04dui1u2s	tenant:shop:create	创建门店	shop	\N	2026-06-14 16:34:59.914
cmqe09230000bj0j04x6ynqvs	tenant:shop:update	编辑门店	shop	\N	2026-06-14 16:34:59.917
cmqe09233000cj0j01z74w7bb	tenant:user:view	查看员工	user	\N	2026-06-14 16:34:59.92
cmqe09236000dj0j09wfb8gys	tenant:user:create	创建员工	user	\N	2026-06-14 16:34:59.922
cmqe09238000ej0j088uvfcxb	tenant:user:update	编辑员工	user	\N	2026-06-14 16:34:59.925
cmqe0923b000fj0j0gqhilccn	tenant:role:view	查看角色	role	\N	2026-06-14 16:34:59.927
cmqe0923d000gj0j082zlpx6l	tenant:role:manage	管理角色	role	\N	2026-06-14 16:34:59.93
cmqe0923g000hj0j0f5dzj3yt	tenant:customer:view	查看客户	customer	\N	2026-06-14 16:34:59.932
cmqe0923i000ij0j0zuh7bspe	tenant:customer:create	创建客户	customer	\N	2026-06-14 16:34:59.935
cmqe0923l000jj0j00mo1mubo	tenant:customer:update	编辑客户	customer	\N	2026-06-14 16:34:59.937
cmqe0923p000kj0j0ru0umfcq	tenant:vehicle:view	查看车辆	vehicle	\N	2026-06-14 16:34:59.941
cmqe0923t000lj0j0bh5hrsjl	tenant:vehicle:create	创建车辆	vehicle	\N	2026-06-14 16:34:59.945
cmqe0923w000mj0j0rerk5v14	tenant:vehicle:update	编辑车辆	vehicle	\N	2026-06-14 16:34:59.948
cmqe0923z000nj0j0jm276qd7	tenant:workorder:view	查看工单	workorder	\N	2026-06-14 16:34:59.951
cmqe09241000oj0j008duh05k	tenant:workorder:create	创建工单	workorder	\N	2026-06-14 16:34:59.954
cmqe09244000pj0j0f286ejtv	tenant:workorder:update	编辑工单	workorder	\N	2026-06-14 16:34:59.957
cmqe09247000qj0j0osctggxs	tenant:inventory:view	查看库存	inventory	\N	2026-06-14 16:34:59.959
cmqe0924a000rj0j0nbjbpsfd	tenant:inventory:manage	管理库存	inventory	\N	2026-06-14 16:34:59.962
cmqe0924d000sj0j0n4jyuen5	tenant:settlement:view	查看结算	settlement	\N	2026-06-14 16:34:59.965
cmqe0924f000tj0j0xyt8guwj	tenant:settlement:manage	管理结算	settlement	\N	2026-06-14 16:34:59.968
cmqe0924i000uj0j01nel2jw2	tenant:member:view	查看会员	member	\N	2026-06-14 16:34:59.97
cmqe0924k000vj0j0gu5ssb01	tenant:member:manage	管理会员	member	\N	2026-06-14 16:34:59.973
cmqe0924n000wj0j04qwa3nfv	tenant:report:view	查看报表	report	\N	2026-06-14 16:34:59.975
cmqe0924p000xj0j0w9gp7t1q	tenant:marketing:manage	管理营销活动	marketing	\N	2026-06-14 16:34:59.978
\.


--
-- Data for Name: receptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.receptions (id, "tenantId", "shopId", "customerId", "vehicleId", "advisorId", "appointmentId", "arriveTime", description, status, "workOrderId", remark, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, "userId", token, "expiresAt", "createdAt") FROM stdin;
cmqg9r9190003rglxjtqgiojf	cmqedifaz003t1060t9nf8w3p	11b59515-7b54-48ca-8437-ae243f9bd6c2	2026-06-23 06:36:37.629	2026-06-16 06:36:37.629
cmqgfo4730001hh16dkhplzht	cmqedifaz003t1060t9nf8w3p	47013c98-18fe-499a-8d5d-58136bf3f449	2026-06-23 09:22:09.086	2026-06-16 09:22:09.088
cmqgjyrxu0001expuc41o0zoh	cmqedifaz003t1060t9nf8w3p	bb95e466-94c7-41e9-8f41-ce4e9951d4f8	2026-06-23 11:22:24.882	2026-06-16 11:22:24.882
cmqh1kce600093fjrkvj6rr7f	cmqedifaz003t1060t9nf8w3p	6e03f70b-2220-40a2-b2f1-4c5accff394d	2026-06-23 19:35:04.638	2026-06-16 19:35:04.638
cmqh1lb2f000b3fjrn8pj3awd	cmqedifaz003t1060t9nf8w3p	b190cfa3-465a-49fd-a717-8d6c6c50eeef	2026-06-23 19:35:49.575	2026-06-16 19:35:49.576
cmqh1sman000d3fjrie5zcdwu	cmqedifaz003t1060t9nf8w3p	80a6c362-5f6f-4d19-b60b-18e7492ec811	2026-06-23 19:41:30.719	2026-06-16 19:41:30.72
cmqh5as82000j3fjrk5f67pjm	cmqedifaz003t1060t9nf8w3p	b2d2cc7a-3cc2-48ec-8934-401d78acf663	2026-06-23 21:19:37.057	2026-06-16 21:19:37.058
cmqi2xmnt0001f3arnbkmmwu1	gray-smoke-admin	64c65d3e-27be-4fa5-9d2f-91deefe65008	2026-06-24 13:01:10.264	2026-06-17 13:01:10.265
cmqi2yg1e000sf3arjhfuv6no	gray-smoke-admin	ff59418b-fde1-48a3-964a-9c50c0a827de	2026-06-24 13:01:48.337	2026-06-17 13:01:48.338
cmqi30jvw0011f3ar1big588t	gray-smoke-admin	5156e69a-4706-4ea8-b549-b64d6f773fe6	2026-06-24 13:03:26.636	2026-06-17 13:03:26.637
cmqi319nt001hf3ar5ckjn5sv	gray-smoke-admin	c1cdc490-36f1-49cc-989c-8ae61ac1c31d	2026-06-24 13:04:00.041	2026-06-17 13:04:00.042
cmqi32kn60001gto82ci1twm3	gray-smoke-admin	4d20c8fc-d426-4925-8526-66dac3f4c5d8	2026-06-24 13:05:00.929	2026-06-17 13:05:00.93
cmqi33c8v001fgto8mvrw8r6n	gray-smoke-admin	aea256fc-a00b-4d1b-9ff8-89b4f728966f	2026-06-24 13:05:36.703	2026-06-17 13:05:36.703
cmqi4yn7e0001ylkle0qq6qlo	gray-smoke-admin	f4f7d948-b1a1-4f36-b298-b514f8048fa6	2026-06-24 13:57:56.857	2026-06-17 13:57:56.858
\.


--
-- Data for Name: reminders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reminders (id, "tenantId", "shopId", type, "customerId", "vehicleId", "relatedId", content, "dueDate", status, "handledBy", "handledAt", remark, "createdAt") FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (id, "roleId", "permissionId") FROM stdin;
role-platform-admin-cmqe0921z0000j0j0ahycs2sk	role-platform-admin	cmqe0921z0000j0j0ahycs2sk
role-platform-admin-cmqe092240001j0j0u8ibzywh	role-platform-admin	cmqe092240001j0j0u8ibzywh
role-platform-admin-cmqe092270002j0j01astxgcf	role-platform-admin	cmqe092270002j0j01astxgcf
role-platform-admin-cmqe0922a0003j0j0tz8hfwsv	role-platform-admin	cmqe0922a0003j0j0tz8hfwsv
role-platform-admin-cmqe0922e0004j0j0vqdo5m80	role-platform-admin	cmqe0922e0004j0j0vqdo5m80
role-platform-admin-cmqe0922j0005j0j0gv3ntnc3	role-platform-admin	cmqe0922j0005j0j0gv3ntnc3
role-platform-admin-cmqe0922m0006j0j0y9h8yk36	role-platform-admin	cmqe0922m0006j0j0y9h8yk36
role-platform-admin-cmqe0922p0007j0j0gcfody1q	role-platform-admin	cmqe0922p0007j0j0gcfody1q
role-platform-admin-cmqe0922s0008j0j0riswv8q6	role-platform-admin	cmqe0922s0008j0j0riswv8q6
role-tenant_admin-cmqe0922v0009j0j0a947kuhg	role-tenant_admin	cmqe0922v0009j0j0a947kuhg
role-tenant_admin-cmqe0922y000aj0j04dui1u2s	role-tenant_admin	cmqe0922y000aj0j04dui1u2s
role-tenant_admin-cmqe09230000bj0j04x6ynqvs	role-tenant_admin	cmqe09230000bj0j04x6ynqvs
role-tenant_admin-cmqe09233000cj0j01z74w7bb	role-tenant_admin	cmqe09233000cj0j01z74w7bb
role-tenant_admin-cmqe09236000dj0j09wfb8gys	role-tenant_admin	cmqe09236000dj0j09wfb8gys
role-tenant_admin-cmqe09238000ej0j088uvfcxb	role-tenant_admin	cmqe09238000ej0j088uvfcxb
role-tenant_admin-cmqe0923b000fj0j0gqhilccn	role-tenant_admin	cmqe0923b000fj0j0gqhilccn
role-tenant_admin-cmqe0923d000gj0j082zlpx6l	role-tenant_admin	cmqe0923d000gj0j082zlpx6l
role-tenant_admin-cmqe0923g000hj0j0f5dzj3yt	role-tenant_admin	cmqe0923g000hj0j0f5dzj3yt
role-tenant_admin-cmqe0923i000ij0j0zuh7bspe	role-tenant_admin	cmqe0923i000ij0j0zuh7bspe
role-tenant_admin-cmqe0923l000jj0j00mo1mubo	role-tenant_admin	cmqe0923l000jj0j00mo1mubo
role-tenant_admin-cmqe0923p000kj0j0ru0umfcq	role-tenant_admin	cmqe0923p000kj0j0ru0umfcq
role-tenant_admin-cmqe0923t000lj0j0bh5hrsjl	role-tenant_admin	cmqe0923t000lj0j0bh5hrsjl
role-tenant_admin-cmqe0923w000mj0j0rerk5v14	role-tenant_admin	cmqe0923w000mj0j0rerk5v14
role-tenant_admin-cmqe0923z000nj0j0jm276qd7	role-tenant_admin	cmqe0923z000nj0j0jm276qd7
role-tenant_admin-cmqe09241000oj0j008duh05k	role-tenant_admin	cmqe09241000oj0j008duh05k
role-tenant_admin-cmqe09244000pj0j0f286ejtv	role-tenant_admin	cmqe09244000pj0j0f286ejtv
role-tenant_admin-cmqe09247000qj0j0osctggxs	role-tenant_admin	cmqe09247000qj0j0osctggxs
role-tenant_admin-cmqe0924a000rj0j0nbjbpsfd	role-tenant_admin	cmqe0924a000rj0j0nbjbpsfd
role-tenant_admin-cmqe0924d000sj0j0n4jyuen5	role-tenant_admin	cmqe0924d000sj0j0n4jyuen5
role-tenant_admin-cmqe0924f000tj0j0xyt8guwj	role-tenant_admin	cmqe0924f000tj0j0xyt8guwj
role-tenant_admin-cmqe0924i000uj0j01nel2jw2	role-tenant_admin	cmqe0924i000uj0j01nel2jw2
role-tenant_admin-cmqe0924k000vj0j0gu5ssb01	role-tenant_admin	cmqe0924k000vj0j0gu5ssb01
role-tenant_admin-cmqe0924n000wj0j04qwa3nfv	role-tenant_admin	cmqe0924n000wj0j04qwa3nfv
role-tenant_admin-cmqe0924p000xj0j0w9gp7t1q	role-tenant_admin	cmqe0924p000xj0j0w9gp7t1q
cmqedif9f000b1060o1byequa	cmqedif9d00091060sd3v9izu	cmqe0922v0009j0j0a947kuhg
cmqedif9i000d1060cwltxagt	cmqedif9d00091060sd3v9izu	cmqe0922y000aj0j04dui1u2s
cmqedif9j000f1060iez69f1l	cmqedif9d00091060sd3v9izu	cmqe09230000bj0j04x6ynqvs
cmqedif9k000h1060eggtrc4w	cmqedif9d00091060sd3v9izu	cmqe09233000cj0j01z74w7bb
cmqedif9l000j1060102kmdek	cmqedif9d00091060sd3v9izu	cmqe09236000dj0j09wfb8gys
cmqedif9m000l1060oujxsgjh	cmqedif9d00091060sd3v9izu	cmqe09238000ej0j088uvfcxb
cmqedif9m000n1060q2uus69q	cmqedif9d00091060sd3v9izu	cmqe0923b000fj0j0gqhilccn
cmqedif9n000p10601rjpt6s9	cmqedif9d00091060sd3v9izu	cmqe0923d000gj0j082zlpx6l
cmqedif9o000r1060u12w60ii	cmqedif9d00091060sd3v9izu	cmqe0923g000hj0j0f5dzj3yt
cmqedif9p000t1060rn7dr30e	cmqedif9d00091060sd3v9izu	cmqe0923i000ij0j0zuh7bspe
cmqedif9q000v106017aoppv8	cmqedif9d00091060sd3v9izu	cmqe0923l000jj0j00mo1mubo
cmqedif9r000x1060osofwfvp	cmqedif9d00091060sd3v9izu	cmqe0923p000kj0j0ru0umfcq
cmqedif9s000z1060b25esiu5	cmqedif9d00091060sd3v9izu	cmqe0923t000lj0j0bh5hrsjl
cmqedif9s00111060cczxytcv	cmqedif9d00091060sd3v9izu	cmqe0923w000mj0j0rerk5v14
cmqedif9t00131060de99orhv	cmqedif9d00091060sd3v9izu	cmqe0923z000nj0j0jm276qd7
cmqedif9u001510601jed35ob	cmqedif9d00091060sd3v9izu	cmqe09241000oj0j008duh05k
cmqedif9v00171060p4xta07v	cmqedif9d00091060sd3v9izu	cmqe09244000pj0j0f286ejtv
cmqedif9w00191060j2jvk928	cmqedif9d00091060sd3v9izu	cmqe09247000qj0j0osctggxs
cmqedif9x001b106007xdgon4	cmqedif9d00091060sd3v9izu	cmqe0924a000rj0j0nbjbpsfd
cmqedif9x001d1060u1k6fudl	cmqedif9d00091060sd3v9izu	cmqe0924d000sj0j0n4jyuen5
cmqedif9y001f1060151hb0dm	cmqedif9d00091060sd3v9izu	cmqe0924f000tj0j0xyt8guwj
cmqedif9z001h1060akf4a0vc	cmqedif9d00091060sd3v9izu	cmqe0924i000uj0j01nel2jw2
cmqedifa0001j1060tctxcs8i	cmqedif9d00091060sd3v9izu	cmqe0924k000vj0j0gu5ssb01
cmqedifa1001l10601t2fhefv	cmqedif9d00091060sd3v9izu	cmqe0924n000wj0j04qwa3nfv
cmqedifa3001p1060wgy27xz3	cmqedifa2001n10607j4l4m2c	cmqe0922v0009j0j0a947kuhg
cmqedifa4001r1060bcttif1t	cmqedifa2001n10607j4l4m2c	cmqe0922y000aj0j04dui1u2s
cmqedifa4001t1060qa6d5f72	cmqedifa2001n10607j4l4m2c	cmqe09230000bj0j04x6ynqvs
cmqedifa5001v1060ltrsw582	cmqedifa2001n10607j4l4m2c	cmqe0923g000hj0j0f5dzj3yt
cmqedifa6001x1060lh8vy95g	cmqedifa2001n10607j4l4m2c	cmqe0923i000ij0j0zuh7bspe
cmqedifa7001z1060usidniob	cmqedifa2001n10607j4l4m2c	cmqe0923l000jj0j00mo1mubo
cmqedifa800211060c8qqrusb	cmqedifa2001n10607j4l4m2c	cmqe0923p000kj0j0ru0umfcq
cmqedifa900231060adn479sj	cmqedifa2001n10607j4l4m2c	cmqe0923t000lj0j0bh5hrsjl
cmqedifa900251060os57appk	cmqedifa2001n10607j4l4m2c	cmqe0923w000mj0j0rerk5v14
cmqedifaa00271060keuhstnj	cmqedifa2001n10607j4l4m2c	cmqe0923z000nj0j0jm276qd7
cmqedifab00291060pqlgbdss	cmqedifa2001n10607j4l4m2c	cmqe09241000oj0j008duh05k
cmqedifac002b1060lhr70uxw	cmqedifa2001n10607j4l4m2c	cmqe09244000pj0j0f286ejtv
cmqedifad002d1060uuzqlg6e	cmqedifa2001n10607j4l4m2c	cmqe09247000qj0j0osctggxs
cmqedifad002f10600of1ns1b	cmqedifa2001n10607j4l4m2c	cmqe0924a000rj0j0nbjbpsfd
cmqedifae002h106079l2zbs7	cmqedifa2001n10607j4l4m2c	cmqe0924d000sj0j0n4jyuen5
cmqedifaf002j1060f0r4bwva	cmqedifa2001n10607j4l4m2c	cmqe0924f000tj0j0xyt8guwj
cmqedifag002l1060neynml6f	cmqedifa2001n10607j4l4m2c	cmqe0924i000uj0j01nel2jw2
cmqedifah002n1060jr1ky1i4	cmqedifa2001n10607j4l4m2c	cmqe0924k000vj0j0gu5ssb01
cmqedifai002p10605665g6b1	cmqedifa2001n10607j4l4m2c	cmqe0924n000wj0j04qwa3nfv
cmqedifak002t1060jzwych9b	cmqedifaj002r1060z114n1xx	cmqe0923g000hj0j0f5dzj3yt
cmqedifak002v10605wye0en8	cmqedifaj002r1060z114n1xx	cmqe0923i000ij0j0zuh7bspe
cmqedifal002x10609x9hcgve	cmqedifaj002r1060z114n1xx	cmqe0923l000jj0j00mo1mubo
cmqedifam002z1060j5w2behp	cmqedifaj002r1060z114n1xx	cmqe0923p000kj0j0ru0umfcq
cmqedifan00311060ouce4aze	cmqedifaj002r1060z114n1xx	cmqe0923t000lj0j0bh5hrsjl
cmqedifao00331060ks2yfehu	cmqedifaj002r1060z114n1xx	cmqe0923w000mj0j0rerk5v14
cmqedifap00351060ifxn1s1j	cmqedifaj002r1060z114n1xx	cmqe0923z000nj0j0jm276qd7
cmqedifaq00371060v5s9m8ai	cmqedifaj002r1060z114n1xx	cmqe09241000oj0j008duh05k
cmqedifar003910608mqsvg62	cmqedifaj002r1060z114n1xx	cmqe0924d000sj0j0n4jyuen5
cmqedifar003b10607kspetfx	cmqedifaj002r1060z114n1xx	cmqe0922v0009j0j0a947kuhg
cmqedifat003f10602mv9fncf	cmqedifas003d1060pv57ei7b	cmqe0923z000nj0j0jm276qd7
cmqedifau003h1060sfl500d1	cmqedifas003d1060pv57ei7b	cmqe09244000pj0j0f286ejtv
cmqedifaw003l106086hgibj2	cmqedifav003j1060nvownvst	cmqe0924d000sj0j0n4jyuen5
cmqedifax003n1060dmlax2k2	cmqedifav003j1060nvownvst	cmqe0924f000tj0j0xyt8guwj
cmqedifay003p1060s1n77ter	cmqedifav003j1060nvownvst	cmqe0924i000uj0j01nel2jw2
cmqedifay003r1060vhfs997p	cmqedifav003j1060nvownvst	cmqe0924k000vj0j0gu5ssb01
cmqi2s6if001199bq8ncerq7e	gray-role-tenant-admin	cmqe0922v0009j0j0a947kuhg
cmqi2s6ii001399bq5p1om58z	gray-role-tenant-admin	cmqe0922y000aj0j04dui1u2s
cmqi2s6ik001599bqyjvbq13w	gray-role-tenant-admin	cmqe09230000bj0j04x6ynqvs
cmqi2s6il001799bqd87a309l	gray-role-tenant-admin	cmqe09233000cj0j01z74w7bb
cmqi2s6in001999bq1vx8jpuw	gray-role-tenant-admin	cmqe09236000dj0j09wfb8gys
cmqi2s6io001b99bqj7e2hmpg	gray-role-tenant-admin	cmqe09238000ej0j088uvfcxb
cmqi2s6iq001d99bqwhwq2qlt	gray-role-tenant-admin	cmqe0923b000fj0j0gqhilccn
cmqi2s6ir001f99bqvrzchovi	gray-role-tenant-admin	cmqe0923d000gj0j082zlpx6l
cmqi2s6it001h99bq6iozgjvu	gray-role-tenant-admin	cmqe0923g000hj0j0f5dzj3yt
cmqi2s6iv001j99bqji0rpfce	gray-role-tenant-admin	cmqe0923i000ij0j0zuh7bspe
cmqi2s6iw001l99bqvr4mdaiv	gray-role-tenant-admin	cmqe0923l000jj0j00mo1mubo
cmqi2s6ix001n99bqt8q5geq0	gray-role-tenant-admin	cmqe0923p000kj0j0ru0umfcq
cmqi2s6iz001p99bqzyzhwlbw	gray-role-tenant-admin	cmqe0923t000lj0j0bh5hrsjl
cmqi2s6j1001r99bqc60dhczr	gray-role-tenant-admin	cmqe0923w000mj0j0rerk5v14
cmqi2s6j3001t99bqy3huc24x	gray-role-tenant-admin	cmqe0923z000nj0j0jm276qd7
cmqi2s6j5001v99bq6u4uqla0	gray-role-tenant-admin	cmqe09241000oj0j008duh05k
cmqi2s6j6001x99bqihmsp54j	gray-role-tenant-admin	cmqe09244000pj0j0f286ejtv
cmqi2s6j8001z99bq0bv7pr67	gray-role-tenant-admin	cmqe09247000qj0j0osctggxs
cmqi2s6ja002199bqz6we9154	gray-role-tenant-admin	cmqe0924a000rj0j0nbjbpsfd
cmqi2s6jc002399bqx90v3by3	gray-role-tenant-admin	cmqe0924d000sj0j0n4jyuen5
cmqi2s6je002599bqhboiga5e	gray-role-tenant-admin	cmqe0924f000tj0j0xyt8guwj
cmqi2s6jf002799bq9hrsvaz3	gray-role-tenant-admin	cmqe0924i000uj0j01nel2jw2
cmqi2s6jh002999bq29rcpq99	gray-role-tenant-admin	cmqe0924k000vj0j0gu5ssb01
cmqi2s6jj002b99bqcg1b1jlh	gray-role-tenant-admin	cmqe0924n000wj0j04qwa3nfv
cmqi2s6jo002d99bq9i1ued6s	gray-smoke-tenant-role-shop_manager	cmqe0922v0009j0j0a947kuhg
cmqi2s6jq002f99bq3ey67w1z	gray-smoke-tenant-role-shop_manager	cmqe0922y000aj0j04dui1u2s
cmqi2s6jr002h99bqaeg68pb1	gray-smoke-tenant-role-shop_manager	cmqe09230000bj0j04x6ynqvs
cmqi2s6jt002j99bq33mh4292	gray-smoke-tenant-role-shop_manager	cmqe0923g000hj0j0f5dzj3yt
cmqi2s6jv002l99bqk18ugneo	gray-smoke-tenant-role-shop_manager	cmqe0923i000ij0j0zuh7bspe
cmqi2s6jw002n99bqc2lzckt1	gray-smoke-tenant-role-shop_manager	cmqe0923l000jj0j00mo1mubo
cmqi2s6jy002p99bq8h59habj	gray-smoke-tenant-role-shop_manager	cmqe0923p000kj0j0ru0umfcq
cmqi2s6k1002r99bqxht5x0tx	gray-smoke-tenant-role-shop_manager	cmqe0923t000lj0j0bh5hrsjl
cmqi2s6k2002t99bqybc6iexh	gray-smoke-tenant-role-shop_manager	cmqe0923w000mj0j0rerk5v14
cmqi2s6k4002v99bqmb6fgdni	gray-smoke-tenant-role-shop_manager	cmqe0923z000nj0j0jm276qd7
cmqi2s6k5002x99bqjae1zd4a	gray-smoke-tenant-role-shop_manager	cmqe09241000oj0j008duh05k
cmqi2s6k7002z99bqjam10dle	gray-smoke-tenant-role-shop_manager	cmqe09244000pj0j0f286ejtv
cmqi2s6k9003199bqqdsaw415	gray-smoke-tenant-role-shop_manager	cmqe09247000qj0j0osctggxs
cmqi2s6ka003399bqpsnk4gdd	gray-smoke-tenant-role-shop_manager	cmqe0924a000rj0j0nbjbpsfd
cmqi2s6kc003599bqijrn70iw	gray-smoke-tenant-role-shop_manager	cmqe0924d000sj0j0n4jyuen5
cmqi2s6ke003799bqk9pea0ti	gray-smoke-tenant-role-shop_manager	cmqe0924f000tj0j0xyt8guwj
cmqi2s6kf003999bqagh1aui2	gray-smoke-tenant-role-shop_manager	cmqe0924i000uj0j01nel2jw2
cmqi2s6kh003b99bq0uw8l3vp	gray-smoke-tenant-role-shop_manager	cmqe0924k000vj0j0gu5ssb01
cmqi2s6kj003d99bq7q8gmb0u	gray-smoke-tenant-role-shop_manager	cmqe0924n000wj0j04qwa3nfv
cmqi2s6kn003f99bqt1o8wvo3	gray-smoke-tenant-role-service_advisor	cmqe0923g000hj0j0f5dzj3yt
cmqi2s6kp003h99bqle4nvfdl	gray-smoke-tenant-role-service_advisor	cmqe0923i000ij0j0zuh7bspe
cmqi2s6kq003j99bq7x818kdh	gray-smoke-tenant-role-service_advisor	cmqe0923l000jj0j00mo1mubo
cmqi2s6kr003l99bqudj0qppf	gray-smoke-tenant-role-service_advisor	cmqe0923p000kj0j0ru0umfcq
cmqi2s6kt003n99bqv44xs3f4	gray-smoke-tenant-role-service_advisor	cmqe0923t000lj0j0bh5hrsjl
cmqi2s6ku003p99bqlaedgixc	gray-smoke-tenant-role-service_advisor	cmqe0923w000mj0j0rerk5v14
cmqi2s6kw003r99bqf5jocgmy	gray-smoke-tenant-role-service_advisor	cmqe0923z000nj0j0jm276qd7
cmqi2s6kx003t99bq16yreigx	gray-smoke-tenant-role-service_advisor	cmqe09241000oj0j008duh05k
cmqi2s6kz003v99bq2xzdb942	gray-smoke-tenant-role-service_advisor	cmqe0924d000sj0j0n4jyuen5
cmqi2s6l0003x99bqdraia7jb	gray-smoke-tenant-role-service_advisor	cmqe0922v0009j0j0a947kuhg
cmqi2s6l4003z99bqsr4tyjoa	gray-smoke-tenant-role-technician	cmqe0923z000nj0j0jm276qd7
cmqi2s6l6004199bqyo9pgsg6	gray-smoke-tenant-role-technician	cmqe09244000pj0j0f286ejtv
cmqi2s6la004399bqwcaddoe9	gray-smoke-tenant-role-cashier	cmqe0924d000sj0j0n4jyuen5
cmqi2s6lb004599bq88d9w6co	gray-smoke-tenant-role-cashier	cmqe0924f000tj0j0xyt8guwj
cmqi2s6ld004799bqoqk8pf30	gray-smoke-tenant-role-cashier	cmqe0924i000uj0j01nel2jw2
cmqi2s6lf004999bqphfi5b5w	gray-smoke-tenant-role-cashier	cmqe0924k000vj0j0gu5ssb01
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, "tenantId", name, code, description, "isBuiltIn", "createdAt", "updatedAt") FROM stdin;
role-platform-admin	\N	平台管理员	platform_admin	\N	t	2026-06-14 16:34:59.98	2026-06-14 16:34:59.98
role-tenant_admin	\N	商户管理员	tenant_admin	\N	t	2026-06-14 16:35:00.021	2026-06-14 16:35:00.021
role-shop_manager	\N	店长	shop_manager	\N	t	2026-06-14 16:35:00.03	2026-06-14 16:35:00.03
role-service_advisor	\N	服务顾问	service_advisor	\N	t	2026-06-14 16:35:00.04	2026-06-14 16:35:00.04
role-technician	\N	技师	technician	\N	t	2026-06-14 16:35:00.043	2026-06-14 16:35:00.043
role-cashier	\N	收银员	cashier	\N	t	2026-06-14 16:35:00.048	2026-06-14 16:35:00.048
cmqedif9d00091060sd3v9izu	cmqedif8y00011060n5q5wabc	商户管理员	tenant_admin	\N	t	2026-06-14 22:46:11.906	2026-06-14 22:46:11.906
cmqedifa2001n10607j4l4m2c	cmqedif8y00011060n5q5wabc	店长	shop_manager	\N	t	2026-06-14 22:46:11.93	2026-06-14 22:46:11.93
cmqedifaj002r1060z114n1xx	cmqedif8y00011060n5q5wabc	服务顾问	service_advisor	\N	t	2026-06-14 22:46:11.947	2026-06-14 22:46:11.947
cmqedifas003d1060pv57ei7b	cmqedif8y00011060n5q5wabc	技师	technician	\N	t	2026-06-14 22:46:11.957	2026-06-14 22:46:11.957
cmqedifav003j1060nvownvst	cmqedif8y00011060n5q5wabc	收银员	cashier	\N	t	2026-06-14 22:46:11.959	2026-06-14 22:46:11.959
gray-role-tenant-admin	gray-smoke-tenant	商户管理员	tenant_admin	\N	t	2026-06-17 12:56:56.053	2026-06-17 13:56:19.732
gray-smoke-tenant-role-shop_manager	gray-smoke-tenant	店长	shop_manager	\N	t	2026-06-17 12:56:56.098	2026-06-17 13:56:19.765
gray-smoke-tenant-role-service_advisor	gray-smoke-tenant	服务顾问	service_advisor	\N	t	2026-06-17 12:56:56.134	2026-06-17 13:56:19.785
gray-smoke-tenant-role-technician	gray-smoke-tenant	技师	technician	\N	t	2026-06-17 12:56:56.151	2026-06-17 13:56:19.801
gray-smoke-tenant-role-cashier	gray-smoke-tenant	收银员	cashier	\N	t	2026-06-17 12:56:56.157	2026-06-17 13:56:19.807
\.


--
-- Data for Name: sequences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sequences (id, "tenantId", key, date, value, "updatedAt") FROM stdin;
cmqe34aqr000012srh9apyhfo	e2e-306-tenant	subscription_order	20260614	4	2026-06-14 18:33:30.414
cmqi2xmqd000bf3arrr2504vq	gray-smoke-tenant	stock_bill_IN	20260617	6	2026-06-17 13:57:56.952
cmqi32kr3000lgto80b05n5mi	gray-smoke-tenant	work_order	20260617	3	2026-06-17 13:57:56.987
cmqi32ksu000sgto8k4d938qp	gray-smoke-tenant	stock_bill_OUT	20260617	4	2026-06-17 13:57:57.04
cmqi32kuz0019gto8rais0tel	gray-smoke-tenant	settlement	20260617	3	2026-06-17 13:57:57.108
\.


--
-- Data for Name: service_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_items (id, "tenantId", name, category, unit, "unitPrice", description, status, "createdAt", "updatedAt") FROM stdin;
cmqedifb4003x1060pxk55kbi	cmqedif8y00011060n5q5wabc	标准洗车	wash	次	30.00	外观清洗+内饰简单整理	active	2026-06-14 22:46:11.969	2026-06-14 22:46:11.969
cmqedifb6003z1060yir8zoei	cmqedif8y00011060n5q5wabc	精洗	wash	次	80.00	内外深度清洁	active	2026-06-14 22:46:11.971	2026-06-14 22:46:11.971
cmqedifb800411060mx4xg59s	cmqedif8y00011060n5q5wabc	打蜡	wash	次	200.00	全车手工打蜡	active	2026-06-14 22:46:11.972	2026-06-14 22:46:11.972
cmqedifb900431060sgvshqvp	cmqedif8y00011060n5q5wabc	内饰清洗	wash	次	150.00	座椅/地毯/顶棚深度清洁	active	2026-06-14 22:46:11.973	2026-06-14 22:46:11.973
cmqedifba00451060rp1o8tuo	cmqedif8y00011060n5q5wabc	发动机舱清洗	wash	次	100.00	发动机舱清洁养护	active	2026-06-14 22:46:11.974	2026-06-14 22:46:11.974
cmqedifbb004710606579qs1c	cmqedif8y00011060n5q5wabc	轮毂清洁	wash	只	30.00	轮毂深度清洁	active	2026-06-14 22:46:11.975	2026-06-14 22:46:11.975
cmqedifbc004910606dioq2of	cmqedif8y00011060n5q5wabc	抛光	wash	次	300.00	漆面抛光翻新	active	2026-06-14 22:46:11.976	2026-06-14 22:46:11.976
cmqedifbd004b106082z4y3e7	cmqedif8y00011060n5q5wabc	镀晶	wash	次	800.00	漆面镀晶保护	active	2026-06-14 22:46:11.977	2026-06-14 22:46:11.977
cmqedifbe004d1060nls8kdzo	cmqedif8y00011060n5q5wabc	贴膜	wash	次	2000.00	全车贴膜（含前挡）	active	2026-06-14 22:46:11.978	2026-06-14 22:46:11.978
cmqedifbf004f1060yep7e65x	cmqedif8y00011060n5q5wabc	机油机滤小保养	maintenance	次	0.00	工时费另计，含机油机滤	active	2026-06-14 22:46:11.98	2026-06-14 22:46:11.98
cmqedifbg004h1060mdu8m5bb	cmqedif8y00011060n5q5wabc	空气滤芯更换	maintenance	个	30.00	空气滤芯材料费	active	2026-06-14 22:46:11.981	2026-06-14 22:46:11.981
cmqedifbh004j1060k8li42a4	cmqedif8y00011060n5q5wabc	空调滤芯更换	maintenance	个	40.00	空调滤芯材料费	active	2026-06-14 22:46:11.982	2026-06-14 22:46:11.982
cmqedifbi004l1060e4g6burq	cmqedif8y00011060n5q5wabc	刹车油更换	maintenance	次	120.00	含刹车油材料+工时	active	2026-06-14 22:46:11.983	2026-06-14 22:46:11.983
cmqedifbj004n1060dte7mwfu	cmqedif8y00011060n5q5wabc	防冻液更换	maintenance	次	100.00	含防冻液材料+工时	active	2026-06-14 22:46:11.984	2026-06-14 22:46:11.984
cmqedifbk004p10609y8ylkka	cmqedif8y00011060n5q5wabc	火花塞更换	maintenance	组	80.00	火花塞材料费（4缸）	active	2026-06-14 22:46:11.985	2026-06-14 22:46:11.985
cmqedifbl004r10601b21lbq0	cmqedif8y00011060n5q5wabc	变速箱油更换	maintenance	次	300.00	含变速箱油+工时	active	2026-06-14 22:46:11.986	2026-06-14 22:46:11.986
cmqedifbn004t1060rtchrajp	cmqedif8y00011060n5q5wabc	正时皮带更换	maintenance	次	500.00	含正时皮带套件+工时	active	2026-06-14 22:46:11.987	2026-06-14 22:46:11.987
cmqedifbo004v1060r4eur2h4	cmqedif8y00011060n5q5wabc	故障诊断	repair	次	50.00	电脑诊断+人工排查	active	2026-06-14 22:46:11.988	2026-06-14 22:46:11.988
cmqedifbp004x106007ucg3v7	cmqedif8y00011060n5q5wabc	刹车片更换（工时）	repair	只	80.00	前/后刹车片更换工时	active	2026-06-14 22:46:11.989	2026-06-14 22:46:11.989
cmqedifbq004z1060ev7rttly	cmqedif8y00011060n5q5wabc	电瓶更换（工时）	repair	次	30.00	电瓶更换工时费	active	2026-06-14 22:46:11.99	2026-06-14 22:46:11.99
cmqedifbr00511060x3tolhp2	cmqedif8y00011060n5q5wabc	雨刮片更换	repair	对	20.00	前/后雨刮片更换工时	active	2026-06-14 22:46:11.991	2026-06-14 22:46:11.991
cmqedifbs00531060b6v1pw3m	cmqedif8y00011060n5q5wabc	大灯更换	repair	只	50.00	大灯总成更换工时	active	2026-06-14 22:46:11.993	2026-06-14 22:46:11.993
cmqedifbu005510605zjl7o6s	cmqedif8y00011060n5q5wabc	空调加氟	repair	次	150.00	空调制冷剂加注	active	2026-06-14 22:46:11.994	2026-06-14 22:46:11.994
cmqedifbv005710608nwqgec1	cmqedif8y00011060n5q5wabc	钣金修复	repair	面	200.00	钣金修复+整形	active	2026-06-14 22:46:11.995	2026-06-14 22:46:11.995
cmqedifbw005910607vkdi4ls	cmqedif8y00011060n5q5wabc	补胎	tire	只	40.00	内补/外补	active	2026-06-14 22:46:11.996	2026-06-14 22:46:11.996
cmqedifbx005b1060dfoupx6h	cmqedif8y00011060n5q5wabc	换胎（只）	tire	只	20.00	轮胎拆装工时费	active	2026-06-14 22:46:11.997	2026-06-14 22:46:11.997
cmqedifbx005d1060x76y0equ	cmqedif8y00011060n5q5wabc	四轮定位	tire	次	150.00	四轮定位调试	active	2026-06-14 22:46:11.998	2026-06-14 22:46:11.998
cmqedifbz005f1060u6koxyws	cmqedif8y00011060n5q5wabc	轮胎换位	tire	次	40.00	四轮换位+胎压检测	active	2026-06-14 22:46:11.999	2026-06-14 22:46:11.999
cmqedifbz005h1060jgnywlp0	cmqedif8y00011060n5q5wabc	动平衡	tire	只	30.00	单轮动平衡	active	2026-06-14 22:46:12	2026-06-14 22:46:12
cmqi2s6nx004l99bq6xrl49yy	gray-smoke-tenant	内饰清洗	wash	次	150.00	座椅/地毯/顶棚深度清洁	active	2026-06-17 12:56:56.254	2026-06-17 13:56:19.913
cmqi2s6nz004n99bqd825h32b	gray-smoke-tenant	发动机舱清洗	wash	次	100.00	发动机舱清洁养护	active	2026-06-17 12:56:56.256	2026-06-17 13:56:19.915
cmqi2s6o1004p99bqgn7j2x9b	gray-smoke-tenant	轮毂清洁	wash	只	30.00	轮毂深度清洁	active	2026-06-17 12:56:56.258	2026-06-17 13:56:19.919
cmqi2s6o3004r99bql152ogyt	gray-smoke-tenant	抛光	wash	次	300.00	漆面抛光翻新	active	2026-06-17 12:56:56.259	2026-06-17 13:56:19.923
cmqi2s6o5004t99bqactqfxm6	gray-smoke-tenant	镀晶	wash	次	800.00	漆面镀晶保护	active	2026-06-17 12:56:56.261	2026-06-17 13:56:19.927
cmqi2s6o6004v99bq2k5ub4sp	gray-smoke-tenant	贴膜	wash	次	2000.00	全车贴膜（含前挡）	active	2026-06-17 12:56:56.263	2026-06-17 13:56:19.93
cmqi2s6oa004z99bqug17qg8e	gray-smoke-tenant	空气滤芯更换	maintenance	个	30.00	空气滤芯材料费	active	2026-06-17 12:56:56.267	2026-06-17 13:56:19.937
cmqi2s6oc005199bq62zr0tio	gray-smoke-tenant	空调滤芯更换	maintenance	个	40.00	空调滤芯材料费	active	2026-06-17 12:56:56.268	2026-06-17 13:56:19.941
cmqi2s6oe005399bqg3k8tfyn	gray-smoke-tenant	刹车油更换	maintenance	次	120.00	含刹车油材料+工时	active	2026-06-17 12:56:56.27	2026-06-17 13:56:19.944
cmqi2s6og005599bqgnupwsw7	gray-smoke-tenant	防冻液更换	maintenance	次	100.00	含防冻液材料+工时	active	2026-06-17 12:56:56.272	2026-06-17 13:56:19.947
cmqi2s6oh005799bqqv9td69k	gray-smoke-tenant	火花塞更换	maintenance	组	80.00	火花塞材料费（4缸）	active	2026-06-17 12:56:56.274	2026-06-17 13:56:19.953
cmqi2s6oj005999bqnwy4kgin	gray-smoke-tenant	变速箱油更换	maintenance	次	300.00	含变速箱油+工时	active	2026-06-17 12:56:56.276	2026-06-17 13:56:19.958
cmqi2s6ol005b99bqwrvi8yw7	gray-smoke-tenant	正时皮带更换	maintenance	次	500.00	含正时皮带套件+工时	active	2026-06-17 12:56:56.278	2026-06-17 13:56:19.961
cmqi2s6on005d99bqjatjyklf	gray-smoke-tenant	故障诊断	repair	次	50.00	电脑诊断+人工排查	active	2026-06-17 12:56:56.279	2026-06-17 13:56:19.964
cmqi2s6op005f99bqcwzzm1eh	gray-smoke-tenant	刹车片更换（工时）	repair	只	80.00	前/后刹车片更换工时	active	2026-06-17 12:56:56.281	2026-06-17 13:56:19.967
cmqi2s6oq005h99bqvquqj9c8	gray-smoke-tenant	电瓶更换（工时）	repair	次	30.00	电瓶更换工时费	active	2026-06-17 12:56:56.283	2026-06-17 13:56:19.969
cmqi2s6os005j99bqtfm88n63	gray-smoke-tenant	雨刮片更换	repair	对	20.00	前/后雨刮片更换工时	active	2026-06-17 12:56:56.285	2026-06-17 13:56:19.972
cmqi2s6ou005l99bqqthypnzy	gray-smoke-tenant	大灯更换	repair	只	50.00	大灯总成更换工时	active	2026-06-17 12:56:56.286	2026-06-17 13:56:19.975
cmqi2s6nu004h99bqtoimdlsd	gray-smoke-tenant	精洗	wash	次	80.00	内外深度清洁	active	2026-06-17 12:56:56.25	2026-06-17 13:56:19.904
cmqi2s6nv004j99bq5svbvx67	gray-smoke-tenant	打蜡	wash	次	200.00	全车手工打蜡	active	2026-06-17 12:56:56.252	2026-06-17 13:56:19.91
cmqi2xmpy0009f3arxwizqciq	gray-smoke-tenant	常规保养	maintenance	次	80.00	\N	active	2026-06-17 13:01:10.343	2026-06-17 13:01:10.343
cmqi30jx90015f3arm1ec5c0t	gray-smoke-tenant	常规保养	maintenance	次	80.00	\N	active	2026-06-17 13:03:26.686	2026-06-17 13:03:26.686
cmqi319pp001pf3ar654b9yic	gray-smoke-tenant	常规保养	maintenance	次	80.00	\N	active	2026-06-17 13:04:00.109	2026-06-17 13:04:00.109
cmqi32kpj0009gto87o1xb7yr	gray-smoke-tenant	常规保养	maintenance	次	80.00	\N	active	2026-06-17 13:05:01.016	2026-06-17 13:05:01.016
cmqi33cam001ngto8wurs8k2t	gray-smoke-tenant	常规保养	maintenance	次	80.00	\N	active	2026-06-17 13:05:36.767	2026-06-17 13:05:36.767
cmqi2s6nr004f99bqd5hrrgyw	gray-smoke-tenant	标准洗车	wash	次	30.00	外观清洗+内饰简单整理	active	2026-06-17 12:56:56.247	2026-06-17 13:56:19.9
cmqi2s6o8004x99bqc0s2v2ka	gray-smoke-tenant	机油机滤小保养	maintenance	次	0.00	工时费另计，含机油机滤	active	2026-06-17 12:56:56.265	2026-06-17 13:56:19.934
cmqi2s6ow005n99bqricn0clj	gray-smoke-tenant	空调加氟	repair	次	150.00	空调制冷剂加注	active	2026-06-17 12:56:56.288	2026-06-17 13:56:19.982
cmqi2s6oy005p99bq2whtdogb	gray-smoke-tenant	钣金修复	repair	面	200.00	钣金修复+整形	active	2026-06-17 12:56:56.29	2026-06-17 13:56:19.985
cmqi2s6p0005r99bq3xvyfw5w	gray-smoke-tenant	补胎	tire	只	40.00	内补/外补	active	2026-06-17 12:56:56.292	2026-06-17 13:56:19.994
cmqi2s6p1005t99bqdnmv5d0o	gray-smoke-tenant	换胎（只）	tire	只	20.00	轮胎拆装工时费	active	2026-06-17 12:56:56.294	2026-06-17 13:56:19.996
cmqi2s6p3005v99bqxkmrp7st	gray-smoke-tenant	四轮定位	tire	次	150.00	四轮定位调试	active	2026-06-17 12:56:56.296	2026-06-17 13:56:19.999
cmqi2s6p5005x99bqe0909rqi	gray-smoke-tenant	轮胎换位	tire	次	40.00	四轮换位+胎压检测	active	2026-06-17 12:56:56.297	2026-06-17 13:56:20.002
cmqi2s6p7005z99bqkm8ztgw4	gray-smoke-tenant	动平衡	tire	只	30.00	单轮动平衡	active	2026-06-17 12:56:56.299	2026-06-17 13:56:20.005
cmqi4yn9m0009ylkll37wbkjz	gray-smoke-tenant	常规保养	maintenance	次	80.00	\N	active	2026-06-17 13:57:56.939	2026-06-17 13:57:56.939
\.


--
-- Data for Name: settlements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settlements (id, "tenantId", "shopId", "settleNo", "workOrderId", "totalAmount", "discountAmount", "payableAmount", "paidAmount", "debtAmount", status, remark, "operatorId", "createdAt", "updatedAt") FROM stdin;
cmqi32kv2001bgto8knda31g6	gray-smoke-tenant	gray-smoke-shop	ST202606170001	cmqi32kr5000ngto8bkaiofvi	125.00	0.00	125.00	125.00	0.00	settled	\N	gray-smoke-admin	2026-06-17 13:05:01.215	2026-06-17 13:05:01.215
cmqi33ceg002hgto8fp7xpkwn	gray-smoke-tenant	gray-smoke-shop	ST202606170002	cmqi33cbt0021gto8lsy3rtjj	125.00	0.00	125.00	125.00	0.00	settled	\N	gray-smoke-admin	2026-06-17 13:05:36.904	2026-06-17 13:05:36.904
cmqi4ynee0013ylklrjq665sn	gray-smoke-tenant	gray-smoke-shop	ST202606170003	cmqi4ynb0000nylkl32kkpe61	125.00	0.00	125.00	125.00	0.00	settled	\N	gray-smoke-admin	2026-06-17 13:57:57.11	2026-06-17 13:57:57.11
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shops (id, "tenantId", name, address, phone, status, "createdAt", "updatedAt") FROM stdin;
cmqedif9600051060bygff3ic	cmqedif8y00011060n5q5wabc	滇码汽修（总店）	\N	\N	active	2026-06-14 22:46:11.899	2026-06-14 22:46:11.899
cmqedpxon0001to7dpgta55pg	demo-tenant	演示管理员（总店）	\N	\N	active	2026-06-14 22:52:02.376	2026-06-14 22:52:02.376
cmqedpxp00005to7dwpoxqxct	e2e-306-tenant	TASK-306 E2E 测试管理员（总店）	\N	\N	active	2026-06-14 22:52:02.388	2026-06-14 22:52:02.388
gray-smoke-shop	gray-smoke-tenant	灰度验收门店（总店）	\N	\N	active	2026-06-17 12:56:56.043	2026-06-17 13:56:19.717
\.


--
-- Data for Name: stock_balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_balances (id, "tenantId", "warehouseId", "partId", quantity, "updatedAt") FROM stdin;
cmqi2xmqo000hf3aryqxbno76	gray-smoke-tenant	gray-smoke-warehouse	cmqi2xmpo0007f3arufyhmhls	20.00	2026-06-17 13:01:10.368
cmqi30jxt001df3arbi4qt650	gray-smoke-tenant	gray-smoke-warehouse	cmqi30jx00013f3ar2t1ztvhk	20.00	2026-06-17 13:03:26.706
cmqi319qa001xf3are70dkpl1	gray-smoke-tenant	gray-smoke-warehouse	cmqi319pe001nf3arvsr3kzcz	20.00	2026-06-17 13:04:00.13
cmqi32kqa000hgto8vxj5z437	gray-smoke-tenant	gray-smoke-warehouse	cmqi32kp70007gto8muyksek7	18.00	2026-06-17 13:05:01.175
cmqi33cb6001vgto8xiwatn33	gray-smoke-tenant	gray-smoke-warehouse	cmqi33cad001lgto8rafrb6rk	19.00	2026-06-17 13:05:36.859
cmqi4yna8000hylklxqtexmjl	gray-smoke-tenant	gray-smoke-warehouse	cmqi4yn9c0007ylkl3wmzdpxt	19.00	2026-06-17 13:57:57.047
\.


--
-- Data for Name: stock_bill_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_bill_items (id, "tenantId", "billId", "partId", quantity, "unitPrice", amount, remark, "createdAt") FROM stdin;
cmqi2xmqg000ff3arliwful5g	gray-smoke-tenant	cmqi2xmqg000df3arfmwu5d37	cmqi2xmpo0007f3arufyhmhls	20.00	25.00	500.00	\N	2026-06-17 13:01:10.361
cmqi30jxn001bf3arp3vmfajs	gray-smoke-tenant	cmqi30jxn0019f3ar18jbpfr2	cmqi30jx00013f3ar2t1ztvhk	20.00	25.00	500.00	\N	2026-06-17 13:03:26.699
cmqi319q3001vf3argr0g965b	gray-smoke-tenant	cmqi319q3001tf3arhycoz02w	cmqi319pe001nf3arvsr3kzcz	20.00	25.00	500.00	\N	2026-06-17 13:04:00.123
cmqi32kq3000fgto8x0zqoq5b	gray-smoke-tenant	cmqi32kq3000dgto8uk25jr83	cmqi32kp70007gto8muyksek7	20.00	25.00	500.00	\N	2026-06-17 13:05:01.036
cmqi32ksv000wgto82k0160ja	gray-smoke-tenant	cmqi32ksv000ugto8ux3yu0qv	cmqi32kp70007gto8muyksek7	1.00	45.00	45.00	\N	2026-06-17 13:05:01.136
cmqi32ktv0015gto89uik1yxu	gray-smoke-tenant	cmqi32ktv0013gto8ifc63ni4	cmqi32kp70007gto8muyksek7	1.00	45.00	45.00	\N	2026-06-17 13:05:01.171
cmqi33cb0001tgto8virw61jh	gray-smoke-tenant	cmqi33cb0001rgto8sfhll0ag	cmqi33cad001lgto8rafrb6rk	20.00	25.00	500.00	\N	2026-06-17 13:05:36.78
cmqi33cd2002agto8dvegk2gz	gray-smoke-tenant	cmqi33cd20028gto83fplacqq	cmqi33cad001lgto8rafrb6rk	1.00	45.00	45.00	\N	2026-06-17 13:05:36.854
cmqi4yna2000fylklgr5u1jt9	gray-smoke-tenant	cmqi4yna1000dylkly5aeyfqj	cmqi4yn9c0007ylkl3wmzdpxt	20.00	25.00	500.00	\N	2026-06-17 13:57:56.954
cmqi4ynch000wylkly7nb8xjt	gray-smoke-tenant	cmqi4ynch000uylklhwgna23b	cmqi4yn9c0007ylkl3wmzdpxt	1.00	45.00	45.00	\N	2026-06-17 13:57:57.041
\.


--
-- Data for Name: stock_bills; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_bills (id, "tenantId", "shopId", "billNo", "billType", "supplierId", "relatedType", "relatedId", status, remark, "operatorId", "createdAt", "updatedAt") FROM stdin;
cmqi2xmqg000df3arfmwu5d37	gray-smoke-tenant	gray-smoke-shop	IN202606170001	in	\N	\N	\N	confirmed	\N	gray-smoke-admin	2026-06-17 13:01:10.361	2026-06-17 13:01:10.361
cmqi30jxn0019f3ar18jbpfr2	gray-smoke-tenant	gray-smoke-shop	IN202606170002	in	\N	\N	\N	confirmed	\N	gray-smoke-admin	2026-06-17 13:03:26.699	2026-06-17 13:03:26.699
cmqi319q3001tf3arhycoz02w	gray-smoke-tenant	gray-smoke-shop	IN202606170003	in	\N	\N	\N	confirmed	\N	gray-smoke-admin	2026-06-17 13:04:00.123	2026-06-17 13:04:00.123
cmqi32kq3000dgto8uk25jr83	gray-smoke-tenant	gray-smoke-shop	IN202606170004	in	\N	\N	\N	confirmed	\N	gray-smoke-admin	2026-06-17 13:05:01.036	2026-06-17 13:05:01.036
cmqi32ksv000ugto8ux3yu0qv	gray-smoke-tenant	gray-smoke-shop	OUT202606170001	out	\N	work_order	cmqi32kr5000ngto8bkaiofvi	confirmed	\N	gray-smoke-admin	2026-06-17 13:05:01.136	2026-06-17 13:05:01.136
cmqi32ktv0013gto8ifc63ni4	gray-smoke-tenant	gray-smoke-shop	OUT202606170002	out	\N	work_order	cmqi32kr5000ngto8bkaiofvi	confirmed	\N	gray-smoke-admin	2026-06-17 13:05:01.171	2026-06-17 13:05:01.171
cmqi33cb0001rgto8sfhll0ag	gray-smoke-tenant	gray-smoke-shop	IN202606170005	in	\N	\N	\N	confirmed	\N	gray-smoke-admin	2026-06-17 13:05:36.78	2026-06-17 13:05:36.78
cmqi33cd20028gto83fplacqq	gray-smoke-tenant	gray-smoke-shop	OUT202606170003	out	\N	work_order	cmqi33cbt0021gto8lsy3rtjj	confirmed	\N	gray-smoke-admin	2026-06-17 13:05:36.854	2026-06-17 13:05:36.854
cmqi4yna1000dylkly5aeyfqj	gray-smoke-tenant	gray-smoke-shop	IN202606170006	in	\N	\N	\N	confirmed	\N	gray-smoke-admin	2026-06-17 13:57:56.954	2026-06-17 13:57:56.954
cmqi4ynch000uylklhwgna23b	gray-smoke-tenant	gray-smoke-shop	OUT202606170004	out	\N	work_order	cmqi4ynb0000nylkl32kkpe61	confirmed	\N	gray-smoke-admin	2026-06-17 13:57:57.041	2026-06-17 13:57:57.041
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_movements (id, "tenantId", "partId", "warehouseId", "movementType", quantity, "balanceAfter", "billId", "billItemId", "relatedType", "relatedId", "operatorId", remark, "createdAt") FROM stdin;
cmqi2xmqs000jf3arvwo4dbve	gray-smoke-tenant	cmqi2xmpo0007f3arufyhmhls	gray-smoke-warehouse	in	20.00	20.00	cmqi2xmqg000df3arfmwu5d37	cmqi2xmqg000ff3arliwful5g	\N	\N	gray-smoke-admin	\N	2026-06-17 13:01:10.372
cmqi30jxw001ff3arvzvz6xn5	gray-smoke-tenant	cmqi30jx00013f3ar2t1ztvhk	gray-smoke-warehouse	in	20.00	20.00	cmqi30jxn0019f3ar18jbpfr2	cmqi30jxn001bf3arp3vmfajs	\N	\N	gray-smoke-admin	\N	2026-06-17 13:03:26.708
cmqi319qc001zf3ars2wkmc0z	gray-smoke-tenant	cmqi319pe001nf3arvsr3kzcz	gray-smoke-warehouse	in	20.00	20.00	cmqi319q3001tf3arhycoz02w	cmqi319q3001vf3argr0g965b	\N	\N	gray-smoke-admin	\N	2026-06-17 13:04:00.132
cmqi32kqd000jgto8nrluds77	gray-smoke-tenant	cmqi32kp70007gto8muyksek7	gray-smoke-warehouse	in	20.00	20.00	cmqi32kq3000dgto8uk25jr83	cmqi32kq3000fgto8x0zqoq5b	\N	\N	gray-smoke-admin	\N	2026-06-17 13:05:01.045
cmqi32kt1000ygto83n9w1lt1	gray-smoke-tenant	cmqi32kp70007gto8muyksek7	gray-smoke-warehouse	out	-1.00	19.00	cmqi32ksv000ugto8ux3yu0qv	cmqi32ksv000wgto82k0160ja	work_order	cmqi32kr5000ngto8bkaiofvi	gray-smoke-admin	\N	2026-06-17 13:05:01.141
cmqi32ku00017gto8a1wl4lkq	gray-smoke-tenant	cmqi32kp70007gto8muyksek7	gray-smoke-warehouse	out	-1.00	18.00	cmqi32ktv0013gto8ifc63ni4	cmqi32ktv0015gto89uik1yxu	work_order	cmqi32kr5000ngto8bkaiofvi	gray-smoke-admin	\N	2026-06-17 13:05:01.176
cmqi33cb8001xgto8obe3rg96	gray-smoke-tenant	cmqi33cad001lgto8rafrb6rk	gray-smoke-warehouse	in	20.00	20.00	cmqi33cb0001rgto8sfhll0ag	cmqi33cb0001tgto8virw61jh	\N	\N	gray-smoke-admin	\N	2026-06-17 13:05:36.788
cmqi33cd8002cgto8etdfu8ss	gray-smoke-tenant	cmqi33cad001lgto8rafrb6rk	gray-smoke-warehouse	out	-1.00	19.00	cmqi33cd20028gto83fplacqq	cmqi33cd2002agto8dvegk2gz	work_order	cmqi33cbt0021gto8lsy3rtjj	gray-smoke-admin	\N	2026-06-17 13:05:36.86
cmqi4ynad000jylkl9rz4ivv1	gray-smoke-tenant	cmqi4yn9c0007ylkl3wmzdpxt	gray-smoke-warehouse	in	20.00	20.00	cmqi4yna1000dylkly5aeyfqj	cmqi4yna2000fylklgr5u1jt9	\N	\N	gray-smoke-admin	\N	2026-06-17 13:57:56.965
cmqi4ynco000yylkl8nz04e78	gray-smoke-tenant	cmqi4yn9c0007ylkl3wmzdpxt	gray-smoke-warehouse	out	-1.00	19.00	cmqi4ynch000uylklhwgna23b	cmqi4ynch000wylkly7nb8xjt	work_order	cmqi4ynb0000nylkl32kkpe61	gray-smoke-admin	\N	2026-06-17 13:57:57.049
\.


--
-- Data for Name: stored_value_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stored_value_cards (id, "tenantId", "cardNo", "customerId", balance, "principalBalance", "giftBalance", status, remark, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: stored_value_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stored_value_transactions (id, "tenantId", "cardId", type, amount, principal, gift, "balanceAfter", "relatedType", "relatedId", "operatorId", remark, "createdAt") FROM stdin;
\.


--
-- Data for Name: subscription_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_orders (id, "tenantId", "orderNo", "planId", months, "originalAmount", "discountRate", amount, status, "paymentMethod", "transactionId", "paidAt", "cancelledAt", "createdAt", "updatedAt") FROM stdin;
cmqe4hgkx0002x18f7qkw4goa	e2e-306-tenant	SUB202606140004	plan-basic	12	2980.00	0.80	2384.00	paid	wechat	trans_mock_12345	2026-06-14 18:33:30.462	\N	2026-06-14 18:33:30.417	2026-06-14 18:33:30.463
\.


--
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_plans (id, name, description, "priceYearly", "maxShops", "maxEmployees", features, status, "createdAt", "updatedAt", discount12m, discount3m, discount6m, "priceMonthly") FROM stdin;
plan-basic	基础版	适合小型门店	2980.00	1	5	"{}"	active	2026-06-14 16:34:59.868	2026-06-14 16:34:59.868	0.80	0.95	0.90	\N
plan-pro	专业版	适合连锁门店	5980.00	5	20	"{}"	active	2026-06-14 16:34:59.873	2026-06-14 16:34:59.873	0.80	0.95	0.90	\N
plan-trial	试用版	新商户试用套餐	0.00	1	5	"{}"	active	2026-06-14 16:34:59.876	2026-06-14 16:34:59.876	0.80	0.95	0.90	\N
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, "tenantId", name, "contactName", phone, address, remark, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: system_parameters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_parameters (id, "tenantId", "group", key, value, remark, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: tenant_feature_flags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_feature_flags (id, "tenantId", "featureFlagId", enabled, "createdAt") FROM stdin;
cmqedifcp006p1060uashed7t	cmqedif8y00011060n5q5wabc	flag-simple-mode	t	2026-06-14 22:46:12.025
cmqi2s6hy000z99bqvrzpmd4w	gray-smoke-tenant	flag-simple-mode	t	2026-06-17 12:56:56.039
\.


--
-- Data for Name: tenant_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_subscriptions (id, "tenantId", "planId", "startAt", "endAt", status, "createdAt", "updatedAt") FROM stdin;
demo-sub	demo-tenant	plan-pro	2026-06-14 16:35:00.136	2027-06-14 16:35:00.136	active	2026-06-14 16:35:00.137	2026-06-14 16:35:00.137
cmqe4hgmb000bx18fmtfw15kl	e2e-306-tenant	plan-basic	2026-06-19 18:33:30.402	2027-06-19 18:33:30.402	active	2026-06-14 18:33:30.467	2026-06-14 18:33:30.467
cmqedif9300031060zbmyw6qr	cmqedif8y00011060n5q5wabc	plan-trial	2026-06-14 22:46:11.823	2026-07-14 22:46:11.823	trial	2026-06-14 22:46:11.896	2026-06-14 22:46:11.896
gray-smoke-sub	gray-smoke-tenant	plan-trial	2026-06-17 12:56:56.026	2026-07-17 13:56:19.701	active	2026-06-17 12:56:56.036	2026-06-17 13:56:19.711
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenants (id, name, "contactName", "contactPhone", status, "createdAt", "updatedAt", "subscriptionEndAt", "subscriptionStatus", "businessType", "employeeCount") FROM stdin;
e2e-306-tenant	TASK-306 E2E 测试租户	\N	\N	active	2026-06-14 18:33:30.405	2026-06-14 18:33:30.469	2027-06-19 18:33:30.402	active	\N	\N
cmqedif8y00011060n5q5wabc	滇码汽修	\N	13658733979	active	2026-06-14 22:46:11.89	2026-06-14 22:46:11.89	2026-07-14 22:46:11.823	trial	wash_beauty	\N
demo-tenant	演示汽修店	张三	13900000000	active	2026-06-14 16:35:00.131	2026-06-15 02:00:00.031	2027-06-14 16:35:00.136	active	\N	\N
gray-smoke-tenant	灰度验收门店	\N	\N	active	2026-06-17 12:56:56.031	2026-06-17 13:56:19.705	2026-07-17 13:56:19.701	trial	\N	\N
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, "userId", "roleId") FROM stdin;
ur-platform-admin-role-platform-admin	platform-admin	role-platform-admin
ur-demo-admin-role-tenant_admin	demo-admin	role-tenant_admin
cmqedifb2003v10604x4ntdbm	cmqedifaz003t1060t9nf8w3p	cmqedif9d00091060sd3v9izu
cmqi2s6ng004b99bqw922ggzq	gray-smoke-admin	gray-role-tenant-admin
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, "tenantId", phone, "passwordHash", name, avatar, "isPlatform", status, "lastLoginAt", "createdAt", "updatedAt", "wxOpenid") FROM stdin;
platform-admin	\N	13800000000	$2b$10$ZcEWXz664gHJ7HiAU5uLn.US0zxXW9avzNyXOcO/fEowyUmZV8N3e	平台管理员	\N	t	active	\N	2026-06-14 16:34:59.857	2026-06-14 16:34:59.857	\N
demo-admin	demo-tenant	13900000001	$2b$10$rHVrlK7fdx8SvBe1rw9NDeWaPA/W2GOw/fXp5Q8rFpCuoNz.Yba66	演示管理员	\N	f	active	\N	2026-06-14 16:35:00.21	2026-06-14 16:35:00.21	\N
e2e-306-admin-user	e2e-306-tenant	13899990000	password123	TASK-306 E2E 测试管理员	\N	f	active	\N	2026-06-14 18:33:30.407	2026-06-14 18:33:30.407	\N
cmqedifaz003t1060t9nf8w3p	cmqedif8y00011060n5q5wabc	13658733979	$2b$10$gtK8mUfKW58c5wgbzJb3RuveBhVCpIe3j4/aQtO8lx0FzPLlbVjhu	管理员	\N	f	active	\N	2026-06-14 22:46:11.964	2026-06-14 22:46:12.031	oBktk3f1kzCqsvWii_b5O7dm-l9U
gray-smoke-admin	gray-smoke-tenant	18800000001	$2b$10$YAKB5X7qqNtPH/36Mdmap.nHYMtQe619LGzhVYRWbTFz0hb55Z78q	灰度管理员	\N	f	active	2026-06-17 13:57:56.861	2026-06-17 12:56:56.232	2026-06-17 13:57:56.862	\N
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicles (id, "tenantId", "customerId", "plateNo", brand, model, vin, "engineNo", color, mileage, "firstRegDate", remark, status, "createdAt", "updatedAt") FROM stdin;
cmqh5cusn000n3fjrly3bvto7	cmqedif8y00011060n5q5wabc	cmqh5cukj000l3fjr9rdvsozd	鲁A·88888	一汽大众	速腾 2013款	\N	\N	\N	5000	\N	{}	active	2026-06-16 21:21:13.704	2026-06-16 21:21:13.704
cmqi2xmpa0005f3ark11tjpmy	gray-smoke-tenant	cmqi2xmoy0003f3arlj9d68fu	京A70310	大众	帕萨特	\N	\N	\N	50000	\N	\N	active	2026-06-17 13:01:10.318	2026-06-17 13:01:10.318
cmqi319p2001lf3aro7pwke69	gray-smoke-tenant	cmqi319or001jf3arxxneko18	京A40079	大众	帕萨特	\N	\N	\N	50000	\N	\N	active	2026-06-17 13:04:00.086	2026-06-17 13:04:00.086
cmqi32kos0005gto8i9915csh	gray-smoke-tenant	cmqi32kog0003gto8ylxi507d	京A00980	大众	帕萨特	\N	\N	\N	50000	\N	\N	active	2026-06-17 13:05:00.988	2026-06-17 13:05:00.988
cmqi33ca1001jgto8k13d360w	gray-smoke-tenant	cmqi33c9s001hgto8ufiivpgj	京A36740	大众	帕萨特	\N	\N	\N	50000	\N	\N	active	2026-06-17 13:05:36.746	2026-06-17 13:05:36.746
cmqi4yn8x0005ylkloepm57zb	gray-smoke-tenant	cmqi4yn8m0003ylklmbrai9qw	京A76906	大众	帕萨特	\N	\N	\N	50000	\N	\N	active	2026-06-17 13:57:56.914	2026-06-17 13:57:56.914
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.warehouses (id, "tenantId", "shopId", name, "isDefault", status, "createdAt", "updatedAt") FROM stdin;
cmqedif99000710603q0oqsyf	cmqedif8y00011060n5q5wabc	cmqedif9600051060bygff3ic	默认仓库	t	active	2026-06-14 22:46:11.901	2026-06-14 22:46:11.901
gray-smoke-warehouse	gray-smoke-tenant	gray-smoke-shop	默认仓库	t	active	2026-06-17 12:56:56.048	2026-06-17 13:56:19.724
\.


--
-- Data for Name: work_order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_order_items (id, "tenantId", "workOrderId", "serviceItemId", "itemType", name, quantity, unit, "unitPrice", amount, "technicianId", remark, "createdAt", "updatedAt", "partId", "supplierId", "warrantyMonths", "warrantyUntil") FROM stdin;
cmqi32kr5000ogto89x328l8c	gray-smoke-tenant	cmqi32kr5000ngto8bkaiofvi	cmqi32kpj0009gto87o1xb7yr	service	常规保养	1.00	次	80.00	80.00	\N	\N	2026-06-17 13:05:01.073	2026-06-17 13:05:01.073	\N	\N	\N	\N
cmqi32kr5000pgto8124zhjdz	gray-smoke-tenant	cmqi32kr5000ngto8bkaiofvi	\N	part	机油滤芯	1.00	次	45.00	45.00	\N	\N	2026-06-17 13:05:01.073	2026-06-17 13:05:01.145	cmqi32kp70007gto8muyksek7	\N	6	2026-12-17 13:05:01.144
cmqi33cbt0022gto8f8fu5edf	gray-smoke-tenant	cmqi33cbt0021gto8lsy3rtjj	cmqi33cam001ngto8wurs8k2t	service	常规保养	1.00	次	80.00	80.00	\N	\N	2026-06-17 13:05:36.809	2026-06-17 13:05:36.809	\N	\N	\N	\N
cmqi33cbt0023gto8oq64c4em	gray-smoke-tenant	cmqi33cbt0021gto8lsy3rtjj	\N	part	机油滤芯	1.00	次	45.00	45.00	\N	\N	2026-06-17 13:05:36.809	2026-06-17 13:05:36.863	cmqi33cad001lgto8rafrb6rk	\N	6	2026-12-17 13:05:36.863
cmqi4ynb0000oylklcxblk0zc	gray-smoke-tenant	cmqi4ynb0000nylkl32kkpe61	cmqi4yn9m0009ylkll37wbkjz	service	常规保养	1.00	次	80.00	80.00	\N	\N	2026-06-17 13:57:56.989	2026-06-17 13:57:56.989	\N	\N	\N	\N
cmqi4ynb1000pylklc4h4jcua	gray-smoke-tenant	cmqi4ynb0000nylkl32kkpe61	\N	part	机油滤芯	1.00	次	45.00	45.00	\N	\N	2026-06-17 13:57:56.989	2026-06-17 13:57:57.053	cmqi4yn9c0007ylkl3wmzdpxt	\N	6	2026-12-17 13:57:57.052
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_orders (id, "tenantId", "shopId", "orderNo", "orderType", "customerId", "vehicleId", "vehiclePlateNo", "vehicleMileage", "advisorId", description, status, "totalAmount", "discountAmount", "payableAmount", remark, "createdAt", "updatedAt", "expectDate") FROM stdin;
cmqi32kr5000ngto8bkaiofvi	gray-smoke-tenant	gray-smoke-shop	WO202606170001	maintenance	cmqi32kog0003gto8ylxi507d	cmqi32kos0005gto8i9915csh	京A00980	\N	\N	灰度验收常规保养	settled	125.00	0.00	125.00	\N	2026-06-17 13:05:01.073	2026-06-17 13:05:01.222	\N
cmqi33cbt0021gto8lsy3rtjj	gray-smoke-tenant	gray-smoke-shop	WO202606170002	maintenance	cmqi33c9s001hgto8ufiivpgj	cmqi33ca1001jgto8k13d360w	京A36740	\N	\N	灰度验收常规保养	settled	125.00	0.00	125.00	\N	2026-06-17 13:05:36.809	2026-06-17 13:05:36.912	\N
cmqi4ynb0000nylkl32kkpe61	gray-smoke-tenant	gray-smoke-shop	WO202606170003	maintenance	cmqi4yn8m0003ylklmbrai9qw	cmqi4yn8x0005ylkloepm57zb	京A76906	\N	\N	灰度验收常规保养	settled	125.00	0.00	125.00	\N	2026-06-17 13:57:56.989	2026-06-17 13:57:57.117	\N
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: app_devices app_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_devices
    ADD CONSTRAINT app_devices_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: coupon_claims coupon_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_claims
    ADD CONSTRAINT coupon_claims_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: dictionaries dictionaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dictionaries
    ADD CONSTRAINT dictionaries_pkey PRIMARY KEY (id);


--
-- Name: dispatch_tasks dispatch_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_tasks
    ADD CONSTRAINT dispatch_tasks_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: inspection_records inspection_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_records
    ADD CONSTRAINT inspection_records_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: package_card_items package_card_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_card_items
    ADD CONSTRAINT package_card_items_pkey PRIMARY KEY (id);


--
-- Name: package_card_transactions package_card_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_card_transactions
    ADD CONSTRAINT package_card_transactions_pkey PRIMARY KEY (id);


--
-- Name: package_cards package_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_cards
    ADD CONSTRAINT package_cards_pkey PRIMARY KEY (id);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: payment_refunds payment_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: receptions receptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptions
    ADD CONSTRAINT receptions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sequences sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_pkey PRIMARY KEY (id);


--
-- Name: service_items service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_pkey PRIMARY KEY (id);


--
-- Name: settlements settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlements
    ADD CONSTRAINT settlements_pkey PRIMARY KEY (id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: stock_balances stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_pkey PRIMARY KEY (id);


--
-- Name: stock_bill_items stock_bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_bill_items
    ADD CONSTRAINT stock_bill_items_pkey PRIMARY KEY (id);


--
-- Name: stock_bills stock_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_bills
    ADD CONSTRAINT stock_bills_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stored_value_cards stored_value_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_value_cards
    ADD CONSTRAINT stored_value_cards_pkey PRIMARY KEY (id);


--
-- Name: stored_value_transactions stored_value_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_value_transactions
    ADD CONSTRAINT stored_value_transactions_pkey PRIMARY KEY (id);


--
-- Name: subscription_orders subscription_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_orders
    ADD CONSTRAINT subscription_orders_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_parameters system_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_parameters
    ADD CONSTRAINT system_parameters_pkey PRIMARY KEY (id);


--
-- Name: tenant_feature_flags tenant_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_feature_flags
    ADD CONSTRAINT tenant_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: tenant_subscriptions tenant_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: work_order_items work_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: app_devices_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "app_devices_tenantId_idx" ON public.app_devices USING btree ("tenantId");


--
-- Name: app_devices_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "app_devices_userId_idx" ON public.app_devices USING btree ("userId");


--
-- Name: appointments_tenantId_appointTime_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_appointTime_idx" ON public.appointments USING btree ("tenantId", "appointTime");


--
-- Name: appointments_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_idx" ON public.appointments USING btree ("tenantId");


--
-- Name: appointments_tenantId_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "appointments_tenantId_shopId_idx" ON public.appointments USING btree ("tenantId", "shopId");


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_targetType_targetId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_targetType_targetId_idx" ON public.audit_logs USING btree ("targetType", "targetId");


--
-- Name: audit_logs_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_tenantId_idx" ON public.audit_logs USING btree ("tenantId");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: coupon_claims_couponId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "coupon_claims_couponId_idx" ON public.coupon_claims USING btree ("couponId");


--
-- Name: coupon_claims_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "coupon_claims_customerId_idx" ON public.coupon_claims USING btree ("customerId");


--
-- Name: coupon_claims_tenantId_customerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "coupon_claims_tenantId_customerId_status_idx" ON public.coupon_claims USING btree ("tenantId", "customerId", status);


--
-- Name: coupon_claims_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "coupon_claims_tenantId_idx" ON public.coupon_claims USING btree ("tenantId");


--
-- Name: coupons_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "coupons_tenantId_idx" ON public.coupons USING btree ("tenantId");


--
-- Name: coupons_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "coupons_tenantId_status_idx" ON public.coupons USING btree ("tenantId", status);


--
-- Name: customers_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customers_tenantId_idx" ON public.customers USING btree ("tenantId");


--
-- Name: customers_tenantId_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customers_tenantId_phone_idx" ON public.customers USING btree ("tenantId", phone);


--
-- Name: dictionaries_tenantId_type_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "dictionaries_tenantId_type_code_key" ON public.dictionaries USING btree ("tenantId", type, code);


--
-- Name: dictionaries_tenantId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dictionaries_tenantId_type_idx" ON public.dictionaries USING btree ("tenantId", type);


--
-- Name: dispatch_tasks_technicianId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dispatch_tasks_technicianId_idx" ON public.dispatch_tasks USING btree ("technicianId");


--
-- Name: dispatch_tasks_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dispatch_tasks_tenantId_idx" ON public.dispatch_tasks USING btree ("tenantId");


--
-- Name: dispatch_tasks_workOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dispatch_tasks_workOrderId_idx" ON public.dispatch_tasks USING btree ("workOrderId");


--
-- Name: employees_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "employees_shopId_idx" ON public.employees USING btree ("shopId");


--
-- Name: employees_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "employees_tenantId_idx" ON public.employees USING btree ("tenantId");


--
-- Name: employees_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "employees_userId_key" ON public.employees USING btree ("userId");


--
-- Name: feature_flags_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX feature_flags_code_key ON public.feature_flags USING btree (code);


--
-- Name: files_businessType_businessId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "files_businessType_businessId_idx" ON public.files USING btree ("businessType", "businessId");


--
-- Name: files_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "files_tenantId_idx" ON public.files USING btree ("tenantId");


--
-- Name: inspection_records_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inspection_records_tenantId_idx" ON public.inspection_records USING btree ("tenantId");


--
-- Name: inspection_records_workOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inspection_records_workOrderId_idx" ON public.inspection_records USING btree ("workOrderId");


--
-- Name: notifications_relatedType_relatedId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_relatedType_relatedId_idx" ON public.notifications USING btree ("relatedType", "relatedId");


--
-- Name: notifications_tenantId_scene_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notifications_tenantId_scene_idx" ON public.notifications USING btree ("tenantId", scene);


--
-- Name: package_card_items_cardId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_card_items_cardId_idx" ON public.package_card_items USING btree ("cardId");


--
-- Name: package_card_items_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_card_items_tenantId_idx" ON public.package_card_items USING btree ("tenantId");


--
-- Name: package_card_transactions_cardId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_card_transactions_cardId_idx" ON public.package_card_transactions USING btree ("cardId");


--
-- Name: package_card_transactions_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_card_transactions_createdAt_idx" ON public.package_card_transactions USING btree ("createdAt");


--
-- Name: package_card_transactions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_card_transactions_tenantId_idx" ON public.package_card_transactions USING btree ("tenantId");


--
-- Name: package_cards_tenantId_cardNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "package_cards_tenantId_cardNo_key" ON public.package_cards USING btree ("tenantId", "cardNo");


--
-- Name: package_cards_tenantId_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_cards_tenantId_customerId_idx" ON public.package_cards USING btree ("tenantId", "customerId");


--
-- Name: package_cards_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_cards_tenantId_idx" ON public.package_cards USING btree ("tenantId");


--
-- Name: parts_tenantId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "parts_tenantId_code_key" ON public.parts USING btree ("tenantId", code);


--
-- Name: parts_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "parts_tenantId_idx" ON public.parts USING btree ("tenantId");


--
-- Name: payment_refunds_paymentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_refunds_paymentId_idx" ON public.payment_refunds USING btree ("paymentId");


--
-- Name: payment_refunds_refundNo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_refunds_refundNo_idx" ON public.payment_refunds USING btree ("refundNo");


--
-- Name: payment_refunds_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_refunds_tenantId_idx" ON public.payment_refunds USING btree ("tenantId");


--
-- Name: payments_settlementId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payments_settlementId_idx" ON public.payments USING btree ("settlementId");


--
-- Name: payments_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payments_tenantId_idx" ON public.payments USING btree ("tenantId");


--
-- Name: payments_transactionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payments_transactionId_idx" ON public.payments USING btree ("transactionId");


--
-- Name: permissions_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);


--
-- Name: receptions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "receptions_tenantId_idx" ON public.receptions USING btree ("tenantId");


--
-- Name: receptions_tenantId_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "receptions_tenantId_shopId_idx" ON public.receptions USING btree ("tenantId", "shopId");


--
-- Name: refresh_tokens_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX refresh_tokens_token_key ON public.refresh_tokens USING btree (token);


--
-- Name: refresh_tokens_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_userId_idx" ON public.refresh_tokens USING btree ("userId");


--
-- Name: reminders_tenantId_shopId_status_dueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "reminders_tenantId_shopId_status_dueDate_idx" ON public.reminders USING btree ("tenantId", "shopId", status, "dueDate");


--
-- Name: reminders_tenantId_type_customerId_vehicleId_relatedId_dueD_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "reminders_tenantId_type_customerId_vehicleId_relatedId_dueD_idx" ON public.reminders USING btree ("tenantId", type, "customerId", "vehicleId", "relatedId", "dueDate");


--
-- Name: role_permissions_roleId_permissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON public.role_permissions USING btree ("roleId", "permissionId");


--
-- Name: roles_tenantId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "roles_tenantId_code_key" ON public.roles USING btree ("tenantId", code);


--
-- Name: roles_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "roles_tenantId_idx" ON public.roles USING btree ("tenantId");


--
-- Name: sequences_tenantId_key_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "sequences_tenantId_key_date_key" ON public.sequences USING btree ("tenantId", key, date);


--
-- Name: service_items_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "service_items_tenantId_category_idx" ON public.service_items USING btree ("tenantId", category);


--
-- Name: service_items_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "service_items_tenantId_idx" ON public.service_items USING btree ("tenantId");


--
-- Name: settlements_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "settlements_tenantId_idx" ON public.settlements USING btree ("tenantId");


--
-- Name: settlements_tenantId_settleNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "settlements_tenantId_settleNo_key" ON public.settlements USING btree ("tenantId", "settleNo");


--
-- Name: settlements_tenantId_workOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "settlements_tenantId_workOrderId_idx" ON public.settlements USING btree ("tenantId", "workOrderId");


--
-- Name: shops_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "shops_tenantId_idx" ON public.shops USING btree ("tenantId");


--
-- Name: stock_balances_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_balances_tenantId_idx" ON public.stock_balances USING btree ("tenantId");


--
-- Name: stock_balances_tenantId_warehouseId_partId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "stock_balances_tenantId_warehouseId_partId_key" ON public.stock_balances USING btree ("tenantId", "warehouseId", "partId");


--
-- Name: stock_bill_items_billId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_bill_items_billId_idx" ON public.stock_bill_items USING btree ("billId");


--
-- Name: stock_bill_items_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_bill_items_tenantId_idx" ON public.stock_bill_items USING btree ("tenantId");


--
-- Name: stock_bills_tenantId_billNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "stock_bills_tenantId_billNo_key" ON public.stock_bills USING btree ("tenantId", "billNo");


--
-- Name: stock_bills_tenantId_billType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_bills_tenantId_billType_idx" ON public.stock_bills USING btree ("tenantId", "billType");


--
-- Name: stock_bills_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_bills_tenantId_idx" ON public.stock_bills USING btree ("tenantId");


--
-- Name: stock_movements_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_movements_createdAt_idx" ON public.stock_movements USING btree ("createdAt");


--
-- Name: stock_movements_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_movements_partId_idx" ON public.stock_movements USING btree ("partId");


--
-- Name: stock_movements_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_movements_tenantId_idx" ON public.stock_movements USING btree ("tenantId");


--
-- Name: stock_movements_warehouseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_movements_warehouseId_idx" ON public.stock_movements USING btree ("warehouseId");


--
-- Name: stored_value_cards_tenantId_cardNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "stored_value_cards_tenantId_cardNo_key" ON public.stored_value_cards USING btree ("tenantId", "cardNo");


--
-- Name: stored_value_cards_tenantId_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stored_value_cards_tenantId_customerId_idx" ON public.stored_value_cards USING btree ("tenantId", "customerId");


--
-- Name: stored_value_cards_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stored_value_cards_tenantId_idx" ON public.stored_value_cards USING btree ("tenantId");


--
-- Name: stored_value_transactions_cardId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stored_value_transactions_cardId_idx" ON public.stored_value_transactions USING btree ("cardId");


--
-- Name: stored_value_transactions_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stored_value_transactions_createdAt_idx" ON public.stored_value_transactions USING btree ("createdAt");


--
-- Name: stored_value_transactions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stored_value_transactions_tenantId_idx" ON public.stored_value_transactions USING btree ("tenantId");


--
-- Name: subscription_orders_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "subscription_orders_tenantId_idx" ON public.subscription_orders USING btree ("tenantId");


--
-- Name: subscription_orders_tenantId_orderNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "subscription_orders_tenantId_orderNo_key" ON public.subscription_orders USING btree ("tenantId", "orderNo");


--
-- Name: subscription_orders_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "subscription_orders_tenantId_status_idx" ON public.subscription_orders USING btree ("tenantId", status);


--
-- Name: suppliers_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "suppliers_tenantId_idx" ON public.suppliers USING btree ("tenantId");


--
-- Name: system_parameters_tenantId_group_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "system_parameters_tenantId_group_key_key" ON public.system_parameters USING btree ("tenantId", "group", key);


--
-- Name: system_parameters_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "system_parameters_tenantId_idx" ON public.system_parameters USING btree ("tenantId");


--
-- Name: tenant_feature_flags_tenantId_featureFlagId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "tenant_feature_flags_tenantId_featureFlagId_key" ON public.tenant_feature_flags USING btree ("tenantId", "featureFlagId");


--
-- Name: tenant_feature_flags_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tenant_feature_flags_tenantId_idx" ON public.tenant_feature_flags USING btree ("tenantId");


--
-- Name: tenant_subscriptions_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tenant_subscriptions_planId_idx" ON public.tenant_subscriptions USING btree ("planId");


--
-- Name: tenant_subscriptions_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tenant_subscriptions_tenantId_idx" ON public.tenant_subscriptions USING btree ("tenantId");


--
-- Name: user_roles_userId_roleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON public.user_roles USING btree ("userId", "roleId");


--
-- Name: user_wxopenid_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_wxopenid_key ON public.users USING btree ("wxOpenid") WHERE ("wxOpenid" IS NOT NULL);


--
-- Name: users_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone);


--
-- Name: users_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_tenantId_idx" ON public.users USING btree ("tenantId");


--
-- Name: users_tenantId_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_tenantId_phone_key" ON public.users USING btree ("tenantId", phone);


--
-- Name: users_wxOpenid_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_wxOpenid_key" ON public.users USING btree ("wxOpenid");


--
-- Name: vehicles_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "vehicles_tenantId_idx" ON public.vehicles USING btree ("tenantId");


--
-- Name: vehicles_tenantId_plateNo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "vehicles_tenantId_plateNo_idx" ON public.vehicles USING btree ("tenantId", "plateNo");


--
-- Name: vehicles_tenantId_vin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "vehicles_tenantId_vin_idx" ON public.vehicles USING btree ("tenantId", vin);


--
-- Name: warehouses_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "warehouses_tenantId_idx" ON public.warehouses USING btree ("tenantId");


--
-- Name: warehouses_tenantId_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "warehouses_tenantId_shopId_idx" ON public.warehouses USING btree ("tenantId", "shopId");


--
-- Name: work_order_items_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "work_order_items_partId_idx" ON public.work_order_items USING btree ("partId");


--
-- Name: work_order_items_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "work_order_items_tenantId_idx" ON public.work_order_items USING btree ("tenantId");


--
-- Name: work_order_items_workOrderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "work_order_items_workOrderId_idx" ON public.work_order_items USING btree ("workOrderId");


--
-- Name: work_orders_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "work_orders_tenantId_createdAt_idx" ON public.work_orders USING btree ("tenantId", "createdAt");


--
-- Name: work_orders_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "work_orders_tenantId_idx" ON public.work_orders USING btree ("tenantId");


--
-- Name: work_orders_tenantId_orderNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "work_orders_tenantId_orderNo_key" ON public.work_orders USING btree ("tenantId", "orderNo");


--
-- Name: work_orders_tenantId_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "work_orders_tenantId_shopId_idx" ON public.work_orders USING btree ("tenantId", "shopId");


--
-- Name: work_orders_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "work_orders_tenantId_status_idx" ON public.work_orders USING btree ("tenantId", status);


--
-- Name: app_devices app_devices_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_devices
    ADD CONSTRAINT "app_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointments appointments_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointments appointments_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appointments appointments_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public.vehicles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: coupon_claims coupon_claims_couponId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_claims
    ADD CONSTRAINT "coupon_claims_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES public.coupons(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: coupon_claims coupon_claims_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_claims
    ADD CONSTRAINT "coupon_claims_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: coupon_claims coupon_claims_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_claims
    ADD CONSTRAINT "coupon_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: coupons coupons_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT "coupons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customers customers_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dictionaries dictionaries_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dictionaries
    ADD CONSTRAINT "dictionaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: dispatch_tasks dispatch_tasks_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_tasks
    ADD CONSTRAINT "dispatch_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dispatch_tasks dispatch_tasks_workOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_tasks
    ADD CONSTRAINT "dispatch_tasks_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: employees employees_shopId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "employees_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public.shops(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employees employees_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employees employees_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: files files_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT "files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: files files_uploadedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT "files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inspection_records inspection_records_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_records
    ADD CONSTRAINT "inspection_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inspection_records inspection_records_workOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_records
    ADD CONSTRAINT "inspection_records_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: package_card_items package_card_items_cardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_card_items
    ADD CONSTRAINT "package_card_items_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES public.package_cards(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: package_card_items package_card_items_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_card_items
    ADD CONSTRAINT "package_card_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: package_card_transactions package_card_transactions_cardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_card_transactions
    ADD CONSTRAINT "package_card_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES public.package_cards(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: package_card_transactions package_card_transactions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_card_transactions
    ADD CONSTRAINT "package_card_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: package_cards package_cards_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_cards
    ADD CONSTRAINT "package_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: parts parts_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT "parts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: parts parts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT "parts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_refunds payment_refunds_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT "payment_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_refunds payment_refunds_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT "payment_refunds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_settlementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES public.settlements(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: receptions receptions_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptions
    ADD CONSTRAINT "receptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: receptions receptions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptions
    ADD CONSTRAINT "receptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: receptions receptions_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptions
    ADD CONSTRAINT "receptions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public.vehicles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reminders reminders_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT "reminders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reminders reminders_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT "reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: roles roles_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_items service_items_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT "service_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: settlements settlements_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlements
    ADD CONSTRAINT "settlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: shops shops_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT "shops_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_balances stock_balances_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT "stock_balances_partId_fkey" FOREIGN KEY ("partId") REFERENCES public.parts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_balances stock_balances_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT "stock_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_balances stock_balances_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_bill_items stock_bill_items_billId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_bill_items
    ADD CONSTRAINT "stock_bill_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES public.stock_bills(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_bill_items stock_bill_items_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_bill_items
    ADD CONSTRAINT "stock_bill_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES public.parts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_bill_items stock_bill_items_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_bill_items
    ADD CONSTRAINT "stock_bill_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_bills stock_bills_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_bills
    ADD CONSTRAINT "stock_bills_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stock_bills stock_bills_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_bills
    ADD CONSTRAINT "stock_bills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_billId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT "stock_movements_billId_fkey" FOREIGN KEY ("billId") REFERENCES public.stock_bills(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT "stock_movements_partId_fkey" FOREIGN KEY ("partId") REFERENCES public.parts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT "stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stored_value_cards stored_value_cards_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_value_cards
    ADD CONSTRAINT "stored_value_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stored_value_transactions stored_value_transactions_cardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_value_transactions
    ADD CONSTRAINT "stored_value_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES public.stored_value_cards(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stored_value_transactions stored_value_transactions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_value_transactions
    ADD CONSTRAINT "stored_value_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: subscription_orders subscription_orders_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_orders
    ADD CONSTRAINT "subscription_orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: subscription_orders subscription_orders_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_orders
    ADD CONSTRAINT "subscription_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: suppliers suppliers_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: system_parameters system_parameters_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_parameters
    ADD CONSTRAINT "system_parameters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tenant_feature_flags tenant_feature_flags_featureFlagId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_feature_flags
    ADD CONSTRAINT "tenant_feature_flags_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES public.feature_flags(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tenant_feature_flags tenant_feature_flags_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_feature_flags
    ADD CONSTRAINT "tenant_feature_flags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tenant_subscriptions tenant_subscriptions_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT "tenant_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tenant_subscriptions tenant_subscriptions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT "tenant_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: vehicles vehicles_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT "vehicles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vehicles vehicles_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT "vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warehouses warehouses_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: work_order_items work_order_items_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT "work_order_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES public.parts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_order_items work_order_items_serviceItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT "work_order_items_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES public.service_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_order_items work_order_items_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT "work_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: work_order_items work_order_items_workOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT "work_order_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_orders work_orders_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT "work_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: work_orders work_orders_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: work_orders work_orders_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public.vehicles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict upfVwrOMhm597UtfovzHasyzic3scsAVOXjTOGMbaJWFifybzEOQPkubtVyAcPR

