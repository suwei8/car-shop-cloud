<template>
  <div class="register-page">
    <div class="register-card">
      <h2>车店云管家</h2>
      <p class="subtitle">免费试用 14 天，无需绑卡</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" size="large">
        <el-form-item prop="shopName">
          <el-input v-model="form.shopName" placeholder="店铺名称" prefix-icon="Shop" />
        </el-form-item>
        <el-form-item prop="phone">
          <el-input v-model="form.phone" placeholder="手机号" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="code">
          <div class="code-row">
            <el-input v-model="form.code" placeholder="验证码" prefix-icon="Message" />
            <el-button
              :disabled="countdown > 0 || sendingCode"
              :loading="sendingCode"
              @click="handleSendCode"
            >
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码（至少8位，含字母和数字）" prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" prefix-icon="Lock" show-password @keyup.enter="handleRegister" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="handleRegister">
            立即注册，免费试用
          </el-button>
        </el-form-item>
      </el-form>
      <div class="login-link">
        已有账号？<router-link to="/login">去登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import api from '../utils/api';

const router = useRouter();
const auth = useAuthStore();
const formRef = ref();
const loading = ref(false);
const sendingCode = ref(false);
const countdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const form = reactive({
  shopName: '',
  phone: '',
  code: '',
  password: '',
  confirmPassword: '',
});

const validateConfirmPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'));
  } else {
    callback();
  }
};

const rules = {
  shopName: [
    { required: true, message: '请输入店铺名称', trigger: 'blur' },
    { min: 2, message: '店铺名称至少2个字符', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少8位', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d).+$/, message: '密码必须包含字母和数字', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
};

async function handleSendCode() {
  try {
    await formRef.value?.validateField('phone');
  } catch {
    return;
  }

  sendingCode.value = true;
  try {
    await api.post('/auth/register/send-code', { phone: form.phone });
    ElMessage.success('验证码已发送');
    countdown.value = 60;
    countdownTimer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(countdownTimer!);
        countdownTimer = null;
      }
    }, 1000);
  } catch {
    // error handled by api interceptor
  } finally {
    sendingCode.value = false;
  }
}

async function handleRegister() {
  await formRef.value?.validate();
  loading.value = true;
  try {
    const res: any = await api.post('/auth/register', {
      shopName: form.shopName,
      phone: form.phone,
      code: form.code,
      password: form.password,
    });
    // Store auth data
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    if (res.user) {
      localStorage.setItem('userInfo', JSON.stringify(res.user));
    }
    auth.token = res.accessToken;
    if (res.user) {
      auth.user = res.user;
    }
    ElMessage.success('注册成功，欢迎使用车店云管家！');
    router.push('/');
  } catch {
    // error handled by api interceptor
  } finally {
    loading.value = false;
  }
}

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<style scoped>
.register-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.register-card {
  width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
.register-card h2 {
  text-align: center;
  margin-bottom: 8px;
  color: #303133;
}
.subtitle {
  text-align: center;
  color: #67c23a;
  margin-bottom: 30px;
  font-size: 16px;
  font-weight: 600;
}
.code-row {
  display: flex;
  gap: 12px;
  width: 100%;
}
.code-row .el-input {
  flex: 1;
}
.login-link {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: #909399;
}
.login-link a {
  color: #409eff;
  text-decoration: none;
}
</style>
