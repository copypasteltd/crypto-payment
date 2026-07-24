import type {
  ConversationShareFile,
  ConversationShareMessage,
} from "@lingban/contracts";
import { Button, Image, Text, Video, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useMemo } from "react";
import { useMobilePageShellClass } from "../../components/MobilePageShell";
import copyIcon from "../../assets/copy.svg";
import {
  mobileApiBaseUrl,
  mobileConversationSharesApi,
} from "../../lib/api";
import {
  rememberPendingMobileShareRoute,
  useMobileShare,
} from "../../lib/mobileShare";
import { useMobileQuery as useQuery } from "../../lib/useMobileQuery";
import { useMobileRouteParams } from "../../lib/useMobileRouteParams";
import { useMobileAuthStore } from "../../stores/mobileAuthStore";

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
}

function roleLabel(role: ConversationShareMessage["role"]) {
  if (role === "agent") return "Agent";
  if (role === "user") return "用户";
  return "系统";
}

function accessLabel(value: string) {
  if (value === "workspace") return "工作区可见";
  if (value === "invited_users") return "指定用户";
  return "链接可见";
}

function absoluteContentUrl(contentPath: string) {
  return `${mobileApiBaseUrl}${contentPath.startsWith("/") ? contentPath : `/${contentPath}`}`;
}

async function copyText(text: string, successTitle: string) {
  await Taro.setClipboardData({ data: text });
  await Taro.showToast({ title: successTitle, icon: "success" });
}

async function openSharedFile(file: ConversationShareFile) {
  if (!file.contentPath) return;
  const url = absoluteContentUrl(file.contentPath);
  if (process.env.TARO_ENV === "h5" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const result = await Taro.downloadFile({ url });
    await Taro.openDocument({
      filePath: result.tempFilePath,
      showMenu: true,
    });
  } catch {
    await Taro.showToast({ title: "附件暂时无法打开", icon: "none" });
  }
}

function SharedFile({ file }: { file: ConversationShareFile }) {
  if (!file.available || !file.contentPath) {
    return (
      <View className="shared-file unavailable">
        <View className="shared-file-title">{file.label}</View>
        <View className="shared-file-meta">附件不可用</View>
      </View>
    );
  }
  const url = absoluteContentUrl(file.contentPath);
  if (file.kind === "image") {
    return (
      <View className="shared-media">
        <View className="shared-file-title">{file.label}</View>
        <Image
          className="shared-image"
          src={url}
          mode="widthFix"
          lazyLoad
          showMenuByLongpress
          onClick={() => void Taro.previewImage({ current: url, urls: [url] })}
        />
      </View>
    );
  }
  if (file.kind === "video") {
    return (
      <View className="shared-media">
        <View className="shared-file-title">{file.label}</View>
        <Video
          className="shared-video"
          src={url}
          controls
          objectFit="contain"
          showCenterPlayBtn
          enableProgressGesture
        />
      </View>
    );
  }
  return (
    <Button className="shared-file" onClick={() => void openSharedFile(file)}>
      <View>
        <View className="shared-file-title">{file.label}</View>
        <View className="shared-file-meta">
          {file.sizeBytes == null ? "附件" : `${Math.max(1, Math.ceil(file.sizeBytes / 1024))} KB`}
        </View>
      </View>
      <View className="shared-file-open">打开</View>
    </Button>
  );
}

export default function ConversationSharePage() {
  const params = useMobileRouteParams<{ id?: string }>();
  const shareId = params?.id?.trim() ?? "";
  const pageShellClass = useMobilePageShellClass("conversation-share-page");
  const authenticated = useMobileAuthStore((state) => state.authenticated);
  const shareQuery = useQuery({
    enabled: Boolean(shareId),
    queryKey: ["mobile", "conversation-share", shareId],
    queryFn: () => mobileConversationSharesApi.getPublic(shareId),
    retry: false,
    staleTime: 60_000,
  });
  const shareTitle = shareQuery.data?.share.title ?? "灵办词元会话记录";
  useMobileShare({
    title: shareTitle,
    timelineTitle: shareTitle,
    route: "/pages/shares/conversation",
    query: { id: shareId },
    enabled: Boolean(shareId && shareQuery.data),
  });

  const filesById = useMemo(
    () => new Map((shareQuery.data?.files ?? []).map((file) => [file.fileId, file])),
    [shareQuery.data?.files]
  );
  const transcript = useMemo(
    () =>
      (shareQuery.data?.messages ?? [])
        .map((message) => `${roleLabel(message.role)} ${formatTime(message.createdAt)}\n${message.text}`)
        .join("\n\n"),
    [shareQuery.data?.messages]
  );
  const errorStatus = (shareQuery.error as { status?: number } | null)?.status;

  const goToLogin = () => {
    rememberPendingMobileShareRoute("/pages/shares/conversation", { id: shareId });
    void Taro.navigateTo({ url: "/pages/auth/index" });
  };

  if (!shareId) {
    return <View className={pageShellClass}><View className="share-state">分享地址无效</View></View>;
  }

  if (shareQuery.isPending) {
    return <View className={pageShellClass}><View className="share-state">正在读取会话快照</View></View>;
  }

  if (shareQuery.isError || !shareQuery.data) {
    const requiresLogin = errorStatus === 401 && !authenticated;
    return (
      <View className={pageShellClass}>
        <View className="share-state error">
          <View className="share-state-title">
            {requiresLogin ? "登录后查看" : errorStatus === 410 ? "分享已失效" : "无法读取分享"}
          </View>
          <View className="share-state-copy">
            {requiresLogin
              ? "该会话限定工作区或指定用户访问。"
              : shareQuery.error instanceof Error
                ? shareQuery.error.message
                : "请检查分享地址后重试。"}
          </View>
          {requiresLogin ? (
            <Button className="send-btn" onClick={goToLogin}>微信登录</Button>
          ) : (
            <Button className="pill active" onClick={() => void shareQuery.refetch()}>重新加载</Button>
          )}
        </View>
      </View>
    );
  }

  const { share, messages } = shareQuery.data;
  return (
    <View className={pageShellClass}>
      <View className="share-header">
        <View className="share-eyebrow">READ-ONLY SESSION</View>
        <View className="share-title">{share.title}</View>
        <View className="share-meta-row">
          <View className="pill active">只读快照</View>
          <View className="pill">{share.sourceType === "session_capture" ? "固化记录" : "会话记录"}</View>
          <View className="pill">{accessLabel(share.accessScope)}</View>
        </View>
        <View className="share-boundary">
          <View><Text className="share-boundary-label">消息</Text><Text>{share.messageCount}</Text></View>
          <View><Text className="share-boundary-label">附件</Text><Text>{share.fileCount}</Text></View>
          <View><Text className="share-boundary-label">创建</Text><Text>{formatTime(share.createdAt)}</Text></View>
        </View>
        <View className="share-actions">
          <Button className="pill active" openType="share">分享</Button>
          <Button className="pill" onClick={() => void copyText(transcript, "会话已复制")}>复制全文</Button>
        </View>
      </View>

      <View className="share-thread">
        {messages.map((message, index) => {
          const messageFiles = message.fileIds
            .map((fileId) => filesById.get(fileId))
            .filter((file): file is ConversationShareFile => Boolean(file));
          return (
            <View className={`shared-message ${message.role}`} key={message.messageId}>
              <View className="shared-message-head">
                <View className="shared-message-role">
                  <View className={`shared-role-mark ${message.role}`} />
                  <Text>{roleLabel(message.role)}</Text>
                </View>
                <View className="shared-message-actions">
                  <Text className="shared-message-time">{formatTime(message.createdAt)}</Text>
                  <Button
                    className="message-copy-button"
                    aria-label={`复制第 ${index + 1} 条消息`}
                    onClick={() => void copyText(message.text, "消息已复制")}
                  >
                    <Image className="message-copy-icon" src={copyIcon} mode="aspectFit" />
                  </Button>
                </View>
              </View>
              {message.text ? <Text className="shared-message-body" selectable userSelect>{message.text}</Text> : null}
              {messageFiles.length > 0 ? (
                <View className="shared-message-files">
                  {messageFiles.map((file) => <SharedFile file={file} key={file.fileId} />)}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View className="share-footer">
        <View className="share-footer-mark" />
        <View>
          <View className="share-footer-title">快照边界</View>
          <View className="share-footer-copy mono">
            {share.sourceType === "session_capture"
              ? "已验证的固化记录"
              : `创建于 ${formatTime(share.createdAt)}`}
          </View>
        </View>
      </View>
    </View>
  );
}
