# 安装指南

## 方法一：使用在线工具生成图标（推荐）

1. 打开浏览器，访问 `file:///D:/code/Chrome%20插件/create_icons.html`
2. 点击"一次性下载所有图标"按钮
3. 图标会保存到您的下载文件夹
4. 将 `icon16.png`, `icon48.png`, `icon128.png` 复制到 `icons` 文件夹

## 方法二：使用任何简单图片

您可以使用任何简单的图片（如时钟、统计图标的图片）：
1. 准备一个16x16的图片
2. 复制并重命名为 `icon16.png`
3. 放大到48x48，保存为 `icon48.png`
4. 放大到128x128，保存为 `icon128.png`
5. 将所有文件放入 `icons` 文件夹

## 方法三：使用Python生成

如果您已安装Python和Pillow库：

```bash
pip install Pillow
python quick_start.py
```

## 安装扩展

1. 打开Chrome浏览器
2. 在地址栏输入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本文件夹（`D:\code\Chrome 插件`）
6. 完成！

## 注意

即使没有图标文件，扩展的核心功能也能正常使用，只是会显示默认图标。

