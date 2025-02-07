import os
import time
import sys
import argparse
from typing import Dict, Optional, Generator
from ai_palette import AIChat, Message, set_log_level
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.live import Live
from rich.layout import Layout
from rich.text import Text
from rich.prompt import Prompt

console = Console()

def setup_api_key() -> None:
    """设置 Deepseek API key"""
    parser = argparse.ArgumentParser(description='Deepseek 推理功能测试')
    parser.add_argument('--api-key', type=str, help='Deepseek API key')
    parser.add_argument('--save', action='store_true', help='是否保存 API key 到环境变量')
    args = parser.parse_args()

    if args.api_key:
        os.environ['DEEPSEEK_API_KEY'] = args.api_key
        if args.save:
            # 获取用户的 shell 配置文件
            shell = os.environ.get('SHELL', '/bin/bash')
            if 'zsh' in shell:
                rc_file = os.path.expanduser('~/.zshrc')
            else:
                rc_file = os.path.expanduser('~/.bashrc')
            
            try:
                with open(rc_file, 'a') as f:
                    f.write(f'\nexport DEEPSEEK_API_KEY="{args.api_key}"\n')
                console.print(f"[green]API key 已保存到 {rc_file}[/green]")
                console.print("[yellow]请运行 source ~/.zshrc 或 source ~/.bashrc 使配置生效[/yellow]")
            except Exception as e:
                console.print(f"[red]保存 API key 失败: {str(e)}[/red]")
    elif not os.getenv('DEEPSEEK_API_KEY'):
        # 如果没有通过命令行参数提供 API key，且环境变量中也没有，则提示用户输入
        console.print("[yellow]未找到 Deepseek API key[/yellow]")
        api_key = Prompt.ask("请输入你的 Deepseek API key")
        save = Prompt.ask("是否保存到环境变量？", choices=["y", "n"], default="n")
        
        os.environ['DEEPSEEK_API_KEY'] = api_key
        if save.lower() == 'y':
            shell = os.environ.get('SHELL', '/bin/bash')
            if 'zsh' in shell:
                rc_file = os.path.expanduser('~/.zshrc')
            else:
                rc_file = os.path.expanduser('~/.bashrc')
            
            try:
                with open(rc_file, 'a') as f:
                    f.write(f'\nexport DEEPSEEK_API_KEY="{api_key}"\n')
                console.print(f"[green]API key 已保存到 {rc_file}[/green]")
                console.print("[yellow]请运行 source ~/.zshrc 或 source ~/.bashrc 使配置生效[/yellow]")
            except Exception as e:
                console.print(f"[red]保存 API key 失败: {str(e)}[/red]")

def get_api_key() -> str:
    """获取 Deepseek API key"""
    api_key = os.getenv('SILICONFLOW_API_KEY')
    if not api_key:
        console.print("[red]错误: 未设置 SILICONFLOW_API_KEY 环境变量[/red]")
        console.print("请访问 https://platform.deepseek.com/api-keys 获取 API key")
        console.print("你可以：")
        console.print("1. 使用命令行参数: python test_deepseek.py --api-key YOUR_API_KEY [--save]")
        console.print("2. 设置环境变量: export DEEPSEEK_API_KEY=YOUR_API_KEY")
        console.print("3. 直接运行程序，根据提示输入")
        exit(1)
    return api_key

def create_chat(streaming: bool = False, timeout: int = 120) -> AIChat:
    """创建 Deepseek 聊天实例
    
    Args:
        streaming: 是否启用流式输出
        timeout: 请求超时时间（秒），默认 120 秒
    """
    return AIChat(
        provider="siliconflow",
        model="deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
        api_key=get_api_key(),
        enable_streaming=streaming,
        timeout=timeout
    )

def test_basic_reasoning():
    """测试基本推理功能"""
    console.rule("[bold blue]测试基本推理功能")
    chat = create_chat()  # 使用默认的 120 秒超时
    
    prompts = [
        "你是谁？",
        "为什么天是蓝色的？",
        "1+1=2，这个数学等式背后的逻辑是什么？",
        "为什么鸟类可以飞行而人类不能？"
    ]
    
    for prompt in prompts:
        console.print(f"\n[bold green]用户:[/bold green] {prompt}")
        response = chat.ask(prompt)
        
        # 显示推理过程
        reasoning = chat.get_last_reasoning_content()
        console.print("\n[bold yellow]推理过程:[/bold yellow]")
        console.print(Panel(Markdown(reasoning), title="Reasoning", border_style="yellow"))
        
        # 显示最终答案
        console.print("\n[bold cyan]最终答案:[/bold cyan]")
        console.print(Panel(Markdown(response), title="Response", border_style="cyan"))
        
        time.sleep(1)

def test_streaming_reasoning():
    """测试流式推理功能"""
    console.rule("[bold blue]测试流式推理功能")
    chat = create_chat(streaming=True)
    
    prompt = "天空为什么是蓝色的？"
    console.print(f"\n[bold green]用户:[/bold green] {prompt}")
    
    # 创建一个自适应布局
    layout = Layout()
    layout.split_column(
        Layout(name="reasoning"),
        Layout(name="answer")
    )
    
    reasoning_text = ""
    answer_text = ""
    
    with Live(layout, refresh_per_second=10, vertical_overflow="visible") as live:
        try:
            for chunk in chat.ask(prompt):
                if chunk["type"] == "reasoning":
                    content = chunk["content"]
                    content = content.replace("<think>", "")
                    content = content.replace("\\n", "\n")
                    reasoning_text += content
                    layout["reasoning"].update(Panel(
                        Markdown(reasoning_text.strip(), code_theme="monokai"),
                        title="[yellow]推理过程[/yellow]",
                        border_style="yellow",
                        expand=True
                    ))
                else:  # type == "content"
                    content = chunk["content"]
                    content = content.replace("\\n", "\n")
                    answer_text += content
                    layout["answer"].update(Panel(
                        Markdown(answer_text.strip(), code_theme="monokai"),
                        title="[cyan]最终答案[/cyan]",
                        border_style="cyan",
                        expand=True
                    ))
                live.refresh()
        except Exception as e:
            console.print(f"\n[red]测试过程中发生错误:[/red] {str(e)}")
            console.print("[red]错误类型:[/red]", type(e).__name__)
            console.print("[red]错误详情:[/red]", str(e))
            return

def test_conversation_reasoning():
    """测试对话中的推理连贯性"""
    console.rule("[bold blue]测试对话推理连贯性")
    chat = create_chat()  # 使用默认的 120 秒超时
    
    conversations = [
        "什么是人工智能？",
        "你能用更通俗的方式解释一下吗？",
        "那机器学习和深度学习有什么区别？",
        "你能总结一下我们刚才讨论的要点吗？"
    ]
    
    for i, prompt in enumerate(conversations, 1):
        console.print(f"\n[bold green]第 {i} 轮对话[/bold green]")
        console.print(f"[bold green]用户:[/bold green] {prompt}")
        
        response = chat.ask(prompt)
        reasoning = chat.get_last_reasoning_content()
        
        # 显示推理过程和答案
        console.print("\n[bold yellow]推理过程:[/bold yellow]")
        console.print(Panel(Markdown(reasoning), title=f"Round {i} Reasoning", border_style="yellow"))
        console.print("\n[bold cyan]回答:[/bold cyan]")
        console.print(Panel(Markdown(response), title=f"Round {i} Response", border_style="cyan"))
        
        time.sleep(1)

def test_complex_reasoning():
    """测试复杂推理场景"""
    console.rule("[bold blue]测试复杂推理场景")
    chat = create_chat(timeout=180)  # 复杂问题使用更长的超时时间
    
    scenarios = [
        {
            "title": "多步骤推理",
            "prompt": "如果地球突然停止自转，会发生什么？请一步步分析可能的后果。"
        },
        {
            "title": "条件推理",
            "prompt": "假设我们能够实现光速旅行，要到达最近的恒星大约需要多长时间？考虑相对论效应。"
        },
        {
            "title": "因果推理",
            "prompt": "为什么恐龙灭绝后，哺乳动物成为了地球的主导物种？分析其中的因果关系。"
        }
    ]
    
    for scenario in scenarios:
        console.print(f"\n[bold magenta]{scenario['title']}[/bold magenta]")
        console.print(f"[bold green]用户:[/bold green] {scenario['prompt']}")
        
        response = chat.ask(scenario['prompt'])
        reasoning = chat.get_last_reasoning_content()
        
        console.print("\n[bold yellow]推理过程:[/bold yellow]")
        console.print(Panel(Markdown(reasoning), title=scenario['title'], border_style="yellow"))
        console.print("\n[bold cyan]最终答案:[/bold cyan]")
        console.print(Panel(Markdown(response), title="Response", border_style="cyan"))
        
        time.sleep(1)

def test_error_handling():
    """测试错误处理"""
    console.rule("[bold blue]测试错误处理")
    
    # 测试无效的 API key
    try:
        chat = AIChat(
            provider="deepseek",
            model="deepseek-reasoner",
            api_key="invalid-key",
            timeout=30
        )
        chat.ask("测试问题")
    except Exception as e:
        console.print("[yellow]预期的认证错误:[/yellow]", str(e))
    
    # 测试空提示词
    chat = create_chat(timeout=30)
    try:
        chat.ask("")
    except Exception as e:
        console.print("[yellow]预期的空提示词错误:[/yellow]", str(e))
    
    # 测试超长提示词
    try:
        chat.ask("测" * 10000)
    except Exception as e:
        console.print("[yellow]预期的超长提示词错误:[/yellow]", str(e))
    
    # 测试网络错误
    try:
        chat = AIChat(
            provider="deepseek",
            model="deepseek-reasoner",
            api_key=get_api_key(),
            api_url="https://invalid-url.example.com",
            timeout=5
        )
        chat.ask("测试问题")
    except Exception as e:
        console.print("[yellow]预期的网络错误:[/yellow]", str(e))
    
    # 测试超时
    try:
        chat = create_chat(timeout=1)
        chat.ask("这是一个需要深入思考的问题...")
    except Exception as e:
        console.print("[yellow]预期的超时错误:[/yellow]", str(e))
    
    console.print("[green]错误处理测试完成[/green]")

def test_retry_mechanism():
    """测试重试机制"""
    console.rule("[bold blue]测试重试机制")
    
    # 创建一个超时时间很短的实例
    chat = create_chat(timeout=2)
    
    try:
        # 发送一个可能触发重试的请求
        response = chat.ask("这是一个测试重试机制的问题")
        console.print("[green]请求最终成功[/green]")
    except Exception as e:
        console.print("[yellow]在重试后仍然失败:[/yellow]", str(e))
    
    console.print("[green]重试机制测试完成[/green]")

def main():
    """主测试函数"""
    console.clear()
    console.rule("[bold blue]Deepseek 推理功能测试")
    
    # 设置日志级别为 DEBUG
    set_log_level("DEBUG")
    
    # 设置 API key
    setup_api_key()
    
    try:
        # 流式推理测试
        test_streaming_reasoning()
        
        # 基本推理测试
        test_basic_reasoning()
        
        # 对话推理测试
        test_conversation_reasoning()
        
        # 复杂推理测试
        test_complex_reasoning()
        
        # 错误处理测试
        test_error_handling()
        
        # 重试机制测试
        test_retry_mechanism()
        
    except KeyboardInterrupt:
        console.print("\n[yellow]测试被用户中断[/yellow]")
    except Exception as e:
        console.print(f"\n[red]测试过程中发生错误:[/red] {str(e)}")
        console.print("[red]错误类型:[/red]", type(e).__name__)
        console.print("[red]错误详情:[/red]", str(e))
        if hasattr(e, '__cause__') and e.__cause__:
            console.print("[red]原始错误:[/red]", str(e.__cause__))
    finally:
        console.rule("[bold blue]测试完成")

if __name__ == "__main__":
    main() 